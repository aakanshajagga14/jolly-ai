class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const sampleRate = options.processorOptions?.sampleRate ?? 48000;
    this.frameSize = Math.round(sampleRate * 0.02);
    this.buffer = [];
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) {
      return true;
    }

    for (let i = 0; i < channel.length; i += 1) {
      this.buffer.push(channel[i]);
      if (this.buffer.length >= this.frameSize) {
        const frame = new Float32Array(this.buffer.splice(0, this.frameSize));
        this.port.postMessage({ type: 'pcm', samples: frame }, [frame.buffer]);
      }
    }

    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
