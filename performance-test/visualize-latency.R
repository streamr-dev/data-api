ReadKey <- function() {
    cat ("Press [enter] to continue")
    line <- readline()
}

# Moving average
MovingAverage <- function(x, n) {
  filter(x, rep(1/n, n), sides=2)
}

# Plot time series with moving average
PlotLatency <- function(latency.data) {
  plot.ts(latency.data$latency,
          ylab="Latency in ms",
          main="Latency over time",
          col="gray",
          log="y"   # logarithmic scale
          )
  lines(MovingAverage(latency.data$latency, 5000), col="black", lwd=2)
}



# Load latency data, take 1st column of CSV
latency.data <- read.csv("latencies.csv", header=T)

# If negative latencies, take offset into consideration
if (min(latency.data$latency) < 0) {
  latency.data$latency <- latency.data$latency - min(latency.data$latency)
}

PlotLatency(latency.data)
ReadKey()

# Print out summary statistics
print(summary(latency.data$latency))
ReadKey()


# Plot distribution of latencies
hist(latency.data$latency,
     breaks=200,    # number of bars
     prob=T,        # y-axis as probability
     col="gray",
     main="Distribution of latency",
     xlab="Latency in ms"
    )

cat("Last package offset", max(latency.data$offset), "\n")
a <- length(table(table(latency.data$client))) == 1 && length(table(table(latency.data$offset))) == 1
cat("All messages received? ", a, "\n")

