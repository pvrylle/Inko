class InkoPcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input?.length) this.port.postMessage(input.slice());
    return true;
  }
}

registerProcessor("inko-pcm-processor", InkoPcmProcessor);
