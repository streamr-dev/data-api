var fs = require("fs")
var tar = require("tar")
var zlib = require("zlib")
var fstream = require("fstream")
var streamBuffers = require("stream-buffers")
var AWS = require("aws-sdk")
var Promise = require("promise")
var SSHClient = require("ssh2").Client;
var constants = require("./constants.js")


AWS.config.region = "eu-west-1"

var keyFile = "/Users/harbu1/.ssh/eric.pem"

var serverParams = {
	ImageId: "ami-c8a5eebf", // Ubuntu 14.10 amd64 HVM
	InstanceType: "m4.xlarge",
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

var ec2 = new AWS.EC2()

// Size of javascript object (or associatve array)
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};


// Reads the streamr-socketio-server project into RAM and gzips it
var readGzipedProjectToBuffer = function() {
	return new Promise(function(resolve, reject) {

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

		stream.on("error", function(err) {
			console.error("failed to read project into RAM")
			reject(err)
		})

		stream.on("finish", function() {
			console.log("read project into RAM")
			resolve(writableStreamBuffer.getContents())
		})
	})
}

var uploadToS3 = function(buffer) {
	return new Promise(function(resolve, reject) {
		var s3 = new AWS.S3()

		s3.upload({
			Bucket: "streamr-socketio-stresstest",
			Key: "stress-test.tar.gz",
			Body: buffer
		}, function(err) {
			if (err) {
				console.error("error when uploading project to s3:", err)
				reject(err)
			} else {
				console.log("project uploaded to s3")
				resolve({})
			}
		})
	})
}

var credentials = fs.readFileSync("/Users/harbu1/.aws/credentials", "utf-8")
var commonUserData = fs.readFileSync("amazon/common_user_data.sh", "utf-8")
	.replace("<CREDENTIALS>", credentials)

var serverUserData = commonUserData + "\n" + fs.readFileSync("amazon/server_user_data.sh", "utf-8")

var composeServerUserData = function(obj) {
	return new Promise(function(resolve, reject) {
		try {
			console.log("server data composed")
			resolve(new Buffer(serverUserData).toString("base64"))
		} catch (err) {
			console.log("failed to compose server user data")
			reject(err)
		}
	})
}

var composeClientUserData = function(serverIps) {
	return new Promise(function(resolve, reject) {
		try {

			var serverIp = serverIps[0].privateIp

			var clientUserData = commonUserData + "\n" +
				fs.readFileSync("amazon/client_user_data.sh", "utf-8")

			clientUserData = clientUserData
				.replace("<SERVER>", "http://" + serverIp + ":" + constants.SERVER_PORT)

			resolve(new Buffer(clientUserData).toString("base64"))
		} catch (err) {
			console.log("failed to compose client user data")
			reject(err)
		}
	})
}

var createEc2Instances = function(params) {
	return function(userData) {
		return new Promise(function(resolve, reject) {
			params.UserData = userData
			ec2.runInstances(params, function(err, data) {
				if (err) {
					console.error("could not create instance: ", err)
					reject(err)
				} else {
					var instanceIds = data.Instances.map(function(instance) {
						return instance.InstanceId
					})
					console.log("instances have been created:", instanceIds)
					resolve(instanceIds)
				}
			})
		})
	}
}

var waitForIpAddressAssignments = function(instanceIds) {
	console.log("waiting for ip addresses")
	return new Promise(function(resolve, reject) {
		ec2.waitFor("instanceRunning", { InstanceIds: instanceIds }, function(err, data) {
			if (err) {
				console.error("Failed to obtain ip address for ", instanceIds)
				reject(err)
			} else {
				var ips = data.Reservations[0].Instances.map(function(instance) {
					return {
						privateIp: instance.PrivateIpAddress,
						publicIp: instance.PublicIpAddress
					}
				})
				console.log("Obtained ", ips)
				resolve(ips)
			}
		})
	})
}

var monitorClientsForResults = function(ips) {

	var collectedData = []

	var publicIps = ips.map(function(ip) {
		return ip.publicIp
	})

	console.log("monitor clients for done signals")

	return new Promise(function(resolve, reject) {
		setInterval(function(intervalReference) {
			publicIps
				.filter(function(ip) { return !(ip in collectedData) })
				.forEach(function(ip) {

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
							collectedData[ip] = JSON.parse(data)

							console.log(collectedData[ip])

							if (Object.size(collectedData) === publicIps.length) {
								console.log("all client instances are done.")
								for (ip in collectedData) {
									console.log(ip,
											collectedData[ip].allMessagesReceived,
											collectedData[ip].latency.mean,
											collectedData[ip].latency.interval
									)
								}

								// Step 8: get server's results
								resolve(collectedData)
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
					host: ip,
					port: 22,
					username: 'ubuntu',
					privateKey: fs.readFileSync(keyFile)
				});
			})
		}, 1000 * 60)
	})
}

var collectServerData = function(serverIp, obj) {
	return function(obj) {
		return new Promise(function(resolve ,reject) {
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
						resolve()
					}).stderr.on('data', function(data) {
						reject(data)
					})
				})
			})

			conn.connect({
				host: serverIp,
				port: 22,
				username: 'ubuntu',
				privateKey: fs.readFileSync(keyFile)
			});
		})
	}
}

var terminateInstances = function(instanceIds) {
	return function() {
		return new Promise(function(resolve, reject) {
			ec2.terminateInstances({InstanceIds: instanceIds}, function(err, data) {
				if (err) {
					console.error("could not terminate instances: ", err)
					reject(err)
				} else {
					console.log("instances have been terminated:", instanceIds)
					resolve()
				}
			})
		})
	}
}

var serverInstanceIdsPromise = readGzipedProjectToBuffer()
	.then(uploadToS3)
	.then(composeServerUserData)
	.then(createEc2Instances(serverParams))

var serverIpsPromise = serverInstanceIdsPromise
	.then(waitForIpAddressAssignments)

var clientInstanceIdsPromise = serverIpsPromise
	.then(composeClientUserData)
	.then(createEc2Instances(clientParams))

var clientIpsPromise = clientInstanceIdsPromise
	.then(waitForIpAddressAssignments)

Promise.all([
		serverIpsPromise,
		clientIpsPromise,
		clientInstanceIdsPromise,
		serverInstanceIdsPromise
]).then(function(data) {
	serverIps = data[0]
	clientIps = data[1]
	instanceIds = data[2].concat(data[3])

		monitorClientsForResults(clientIps)
			.then(collectServerData(serverIps[0].publicIp))
			.then(terminateInstances(instanceIds))
			.done()
})

// TODO: ec2 shutdowns
// TODO: collecting latency.csv files
// TODO: better error handling
