var SAMPLE_RATE = 3000; // 3 seconds
var lastSample = Date.now();
function sample() {
  if (Date.now() - lastSample >= SAMPLE_RATE * 2) {
    // Code here will only run if the timer is delayed by more 2X the sample rate
    // (e.g. if the laptop sleeps for more than 3-6 seconds)
  }
  lastSample = Date.now();
  setTimeout(sample, SAMPLE_RATE);
}

sample();
