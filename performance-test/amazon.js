var fs = require("fs")
var tar = require("tar")
var zlib = require("zlib")
var fstream = require("fstream")
var streamBuffers = require("stream-buffers")
var AWS = require("aws-sdk")

var constants = require("./constants.js")


AWS.config.region = "eu-west-1"

var writableStreamBuffer = new streamBuffers.WritableStreamBuffer({
	initialSize: (500 * 1024),
	incrementAmount: (500 * 1024)
})

var stream = fstream.Reader({
	"path": "../../streamr-socketio-server",
	"type": "Directory"
}).pipe(tar.Pack())
	.pipe(zlib.Gzip())
	.pipe(writableStreamBuffer)

stream.on("finish", function() {

	console.log("read project to RAM")

	// Upload file to s3
	var s3 = new AWS.S3()

	s3.upload({
		Bucket: "streamr-socketio-stresstest",
		Key: "stress-test.tar.gz",
		Body: writableStreamBuffer.getContents()
	}, function(err) {
		if (err) {
			console.log("error when uploading project to s3:", err)
		} else {
			console.log("project uploaded to s3")

		  // Start up server instance
			var ec2 = new AWS.EC2()

			var credentials = fs.readFileSync("/Users/harbu1/.aws/credentials", "utf-8")
			var commonUserData = fs.readFileSync("amazon/common_user_data.sh", "utf-8")
				.replace("<CREDENTIALS>", credentials)

			var clientUserData = commonUserData + "\n" +
				fs.readFileSync("amazon/client_user_data.sh", "utf-8")

			var serverUserData = commonUserData + "\n" +
				fs.readFileSync("amazon/server_user_data.sh", "utf-8")

			var serverParams = {
				ImageId: "ami-daa5eead", // Ubuntu 14.10 amd64 ebs
				InstanceType: "m1.large",
				MinCount: 1,
				MaxCount: 1,
				KeyName: "eric",
				SecurityGroups: [
					"default",
					"SSH-from-sujuwa",
					"streamr-socketio-server"
				],
				UserData: new Buffer(serverUserData).toString("base64")
			}

			ec2.runInstances(serverParams, function(err, data) {
				if (err) {
					console.log("Could not create instance", err)
					return
				}

				console.log("server instance created, waiting to obtain ip address")

				var serverInstanceId = data.Instances[0].InstanceId

				ec2.waitFor("instanceRunning", { InstanceIds: [serverInstanceId] }, function(err, data) {
					if (err) {
						console.log("Instance could not be run", err)
						return
					}

					var serverIp = data.Reservations[0].Instances[0].PrivateIpAddress;

					clientUserData = clientUserData.replace("<SERVER>", "http://" + serverIp + ":" + constants.SERVER_PORT)
						.replace("<IP>", serverIp)

					console.log(clientUserData)

					var clientParams = {
						ImageId: "ami-daa5eead", // Ubuntu 14.10 amd64 ebs
						InstanceType: "m1.medium",
						MinCount: constants.NUM_OF_EC2_INSTANCES - 1,
						MaxCount: constants.NUM_OF_EC2_INSTANCES - 1,
						KeyName: "eric",
						SecurityGroups: [ "default", "SSH-from-sujuwa" ],
						UserData: new Buffer(clientUserData).toString("base64")
					}


					// Create the client instances
					ec2.runInstances(clientParams, function(err, data) {
						if (err) {
							console.log("Could not create instance", err)
							return
						}


						var instanceIds = data.Instances.map(function(instance) {
							return instance.InstanceId
						})
						console.log("Created instances", instanceIds)

						params = {
							Resources: instanceIds,
							Tags: [{ Key: "Owner", Value: "eric" }]
						}

						ec2.createTags(params, function(err) {
							console.log("Tagging instance", err ? "failure" : "success")
						})
					})
				})
			})
		}
	})
})
