/**
 * Fingerpring blocks
 */
//% weight=100 color=#f81e96 icon="\uf577" block="Fingerprint"
namespace fingerprint {
    const DEBUG = false

    enum CMD {
        OK = 0x0,
        VERIFY_PWD = 0x13,
    }

    export function connect(rx: SerialPin, tx: SerialPin): void {
        // At power on, it takes about 200ms for initialization
        basic.pause(250)
        serial.redirect(tx, rx, BaudRate.BaudRate57600)
        basic.pause(1000)

        if (DEBUG) {
            control.onEvent(DAL.MICROBIT_ID_SERIAL, DAL.MICROBIT_SERIAL_EVT_RX_FULL, function () {
                basic.showIcon(IconNames.No)
            })
        }


    }

    function verifyPassword(): boolean {
        const buf = pins.createBuffer(8)
        buf.setNumber(NumberFormat.UInt16LE, 0, CMD.VERIFY_PWD);
        buf.setNumber(NumberFormat.UInt8LE, 2, 1)
        buf.setNumber(NumberFormat.UInt8LE, 3, 1)
        buf.setNumber(NumberFormat.UInt8LE, 4, 1)
        buf.setNumber(NumberFormat.UInt8LE, 5, 1)
        buf.setNumber(NumberFormat.UInt8LE, 6, 1)
        buf.setNumber(NumberFormat.UInt8LE, 7, 1)
        tx(buf)
        return true
    }

    function tx(bytes: Buffer): void {
        serial.writeBuffer(bytes)
    }

    function problemEncountered(): void {
        basic.showIcon(IconNames.No)
    }
}