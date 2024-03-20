class FingerprintSimulator implements Uart { 
    constructor() { }

    writeBuffer(buf: Buffer): void {
        console.log("FakeFingerprint: writeBuffer");
    }

    readBuffer(): Buffer {
        console.log("FakeFingerprint: readBuffer");
        return pins.createBuffer(0);
    }
}
