ReadKey <- function() {
    cat ("Press [enter] to continue")
    line <- readline()
}

# Load latency data, take 1st column of CSV
latency.data <- read.csv("latencies.csv", header=T)

# Moving average
MovingAverage <- function(x, n) {
  filter(x, rep(1/n, n), sides=2)
}

# Plot time series with moving average
plot.ts(latency.data$latency,
        ylab="Latency in ms",
        main="Latency over time",
        col="gray",
        #log="y"   # logarithmic scale
        )
lines(MovingAverage(latency.data$latency, 2500), col="black", lwd=2)
ReadKey()

# Print out summary statistics
print(summary(latency.data$latency))
ReadKey()


# Plot distribution of latencies
hist(latency.data,
     breaks=200,    # number of bars
     prob=T,        # y-axis as probability
     col="gray",
     main="Distribution of latency",
     xlab="Latency in ms"
    )
