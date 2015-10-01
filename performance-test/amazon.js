var fs = require("fs")
var tar = require("tar")
var zlib = require("zlib")
var fstream = require("fstream")
var streamBuffers = require("stream-buffers")
var AWS = require("aws-sdk")

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

			var params = {
				ImageId: "ami-daa5eead", // Ubuntu 14.10 amd64 ebs
				InstanceType: "t1.micro",
				MinCount: 4,
				MaxCount: 4,
				KeyName: "eric",
				SecurityGroups: [ "default", "SSH-from-sujuwa" ],
				UserData: new Buffer(commonUserData).toString("base64")
			}

			// Create the instances
			ec2.runInstances(params, function(err, data) {
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

		}
	})
})





