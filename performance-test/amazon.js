var fs = require("fs")
var tar = require("tar")
var zlib = require("zlib")
var fstream = require("fstream")
var streamBuffers = require("stream-buffers")
var AWS = require("aws-sdk")
var SSHClient = require("ssh2").Client;

var constants = require("./constants.js")

AWS.config.region = "eu-west-1"

var serverParams = {
	ImageId: "ami-c8a5eebf", // Ubuntu 14.10 amd64 HVM
	InstanceType: "t2.large",
	MinCount: 1,
	MaxCount: 1,
	KeyName: "eric",
	SecurityGroupIds: [
		"sg-76e63a12",             // default
		"sg-8fe13deb",             // SSH from Sujuwa
		"sg-0be23e6f"              // streamr-socketio-server
	],
	SubnetId: "subnet-18abf07d"  // VPC
}

var clientParams = {
	ImageId: "ami-c8a5eebf",     // Ubuntu 14.10 amd64 HVM
	InstanceType: "c4.large",
	MinCount: constants.NUM_OF_EC2_INSTANCES - 1,
	MaxCount: constants.NUM_OF_EC2_INSTANCES - 1,
	KeyName: "eric",
	SecurityGroupIds: [
		"sg-76e63a12",             // default
		"sg-8fe13deb",             // SSH from Sujuwa
	],
	SubnetId: "subnet-18abf07d"  // VPC
}

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

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

			serverParams.UserData = new Buffer(serverUserData).toString("base64")

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

					var serverIp = data.Reservations[0].Instances[0].PrivateIpAddress
					var publicServerIp = data.Reservations[0].Instances[0].PublicIpAddress

					console.log("Server running at " +
							data.Reservations[0].Instances[0].PublicIpAddress);

					clientUserData = clientUserData
						.replace("<SERVER>", "http://" + serverIp + ":" + constants.SERVER_PORT)

					console.log(clientUserData)

					clientParams.UserData = new Buffer(clientUserData).toString("base64")

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

						ec2.waitFor("instanceRunning", { InstanceIds: instanceIds }, function(err, data) {
							if (err) {
								console.log("Instance could not be run", err)
									return
							}

							var reservation = data.Reservations[0]
							var clientIps = reservation.Instances.map(function(instance) {
								return instance.PublicIpAddress
							})

							console.log("Client ips ", clientIps)

							var collectedData = []

							setInterval(function(intervalReference) {
								clientIps
									.filter(function(clientIp) { return !(clientIp in collectedData) })
									.forEach(function(clientIp) {

									var conn = new SSHClient();

									conn.on('ready', function() {
										conn.exec("cat done", function(err, stream) {
											if (err) {
												console.log(err);
											}

											stream.on("close", function(code, signal) {
												conn.end();
											})

											stream.on('data', function(data) {
												collectedData[clientIp] = JSON.parse(data)

												console.log(collectedData[clientIp])

												if (Object.size(collectedData) === clientIps.length) {
													console.log("Instances finished")
													for (ip in collectedData) {
														console.log(ip,
																collectedData[ip].allMessagesReceived,
																collectedData[ip].latency.mean,
																collectedData[ip].latency.interval
														)
													}
													collectServerData(publicServerIp)
													clearTimeout(intervalReference)
												}
											}).stderr.on('data', function(data) {
												console.log("STDERR: " + data)
											});

										});
									})

									conn.on("error", function(err) {
										console.log("SSH" + err)
									})

									conn.connect({
										host: clientIp,
										port: 22,
										username: 'ubuntu',
										privateKey: fs.readFileSync('/Users/harbu1/.ssh/eric.pem')
									});
								})
							}, 1000 * 60)
						})
					})
				})
			})
		}
	})
})

function collectServerData(serverIp) {
	var conn = new SSHClient()

	conn.on('ready', function() {
		conn.exec("cat done", function(err, stream) {
			if (err) {
				console.log(err);
			}

			stream.on("close", function(code, signal) {
				conn.end();
			})

			stream.on('data', function(data) {
				console.log("Server:", JSON.parse(data))
			}).stderr.on('data', function(data) {
				console.log("STDERR: " + data)
			})
		})
	})

	conn.connect({
		host: serverIp,
		port: 22,
		username: 'ubuntu',
		privateKey: fs.readFileSync('/Users/harbu1/.ssh/eric.pem')
	});
}

// TODO: ec2 shutdowns
// TODO: collecting latency.csv files
// TODO: better error handling
// TODO: refactor callback hell
