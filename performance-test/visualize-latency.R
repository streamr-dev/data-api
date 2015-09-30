# Load latency data, take 1st column of CSV
latency.data <- read.csv("latencies.csv")[, 2]

# Moving average
MovingAverage <- function(x, n) {
  filter(x,rep(1/n,n), sides=2)
}

# Plot time series with moving average
plot.ts(latency.data,
        ylab="Latency in ms",
        main="Latency over time",
        col="gray",
        #log="y"   # logarithmic scale
        )

lines(MovingAverage(latency.data, 2000), col="black", lwd=2)

# Print out summary statistics
print(summary(latency.data))
