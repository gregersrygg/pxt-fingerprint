/**
 * Fingerprint blocks
 */
//% weight=100 color=#f81e96 icon="\uf577" block="Fingerprint"
namespace fingerprint {
    const DEBUG = false

    enum CMD {
        OK = 0x0,
        VERIFY_PWD = 0x13,
    }

    enum RET_CODE {
        EXECUTION_COMPLETE = 0x0,
        ERROR_REC_DATA_PACKET = 0x1,
        NO_FINGER_ON_SENSOR = 0x2,
        FAILED_TO_ENROLL_FINGER = 0x3,
        FAILED_UNCLEAR_FINGER_IMG = 0x6,
        FAILED_LACKING_FINGER_IMG = 0x7,
        FINGER_NOT_MATCHING = 0x8,
        FAILED_TO_FIND_MATCHING_FINGER = 0x9,
        FAILED_TO_COMBINE_CHARACTER_FILES = 0x0A,
        PAGEID_BEYOND_FINGER_LIB = 0x0B,
        ERROR_READING_TEMPLATE_OR_TEMPLATE_INVALID = 0x0C,
        ERROR_UPLOADING_TEMPLATE = 0x0D,
        ERROR_RECEIVING_DATA_PACKAGES = 0x0E,
        ERROR_UPLOADING_IMG = 0x0F,
        FAILED_TO_DELETE_TEMPLATE = 0x10,
        FAILED_TO_CLEAR_FINGER_LIB = 0x11,
        WRONG_PASSWORD = 0x13,
        FAILED_TO_GENERATE_IMG_NO_VALID_PRIMARY_IMG = 0x15,
        ERROR_WRITING_TO_FLASH = 0x18,
        NO_DEFINITION_ERROR = 0x19,
        INVALID_REGISTER_ERROR = 0x1A,
        INCORRECT_CONFIG_OF_REGISTER = 0x1B,
        WRONG_NOTEPAD_PAGE_NUM = 0x1C,
        FAILED_TO_OPERATE_COMMUNICATION_PORT = 0x1D,
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

    export function verifyPassword(): boolean {
        const dataBuf = pins.createBuffer(5)
        dataBuf.setNumber(NumberFormat.UInt8BE, 0, CMD.VERIFY_PWD);
        dataBuf.setNumber(NumberFormat.UInt32BE, 1, 0x00000000)
        
        tx(createTxBuf(0x1, dataBuf))

        const res = serial.readBuffer(12)
        const code = res.getUint8(9)
        if (code == RET_CODE.EXECUTION_COMPLETE) {
            basic.showIcon(IconNames.Yes)
        } else if (code == RET_CODE.WRONG_PASSWORD) {
            basic.showIcon(IconNames.No)
        } else if (code == RET_CODE.ERROR_REC_DATA_PACKET) {
            problemEncountered()
        } else {
            basic.showNumber(code)
        }
        return true
    }

    function createTxBuf(pid: number, data: Buffer): Buffer {
        const bufLen =
            2 + // header
            4 + // adder
            1 + // packet id
            2 + // packet len
            data.length + // data
            2 // checksum
        const dataLen =
            data.length + // data
            2 // checksum
        const buf = pins.createBuffer(bufLen)
        buf.setNumber(NumberFormat.UInt16BE, 0, 0xEF01)
        buf.setNumber(NumberFormat.UInt32BE, 2, 0xFFFFFFFF)
        buf.setNumber(NumberFormat.UInt8BE, 6, pid)
        buf.setNumber(NumberFormat.UInt16BE, 7, dataLen)
        buf.write(9, data)

        let checksum = pid + (dataLen >> 8) + (dataLen & 0xFF);
        for (let i=0; i<data.length; i++) {
            checksum += data.getNumber(NumberFormat.UInt8BE, i)
        }

        buf.setNumber(NumberFormat.UInt16BE, 9 + data.length, checksum & 0xFFFF)

        return buf
    }

    function tx(bytes: Buffer): void {
        serial.writeBuffer(bytes)
    }

    function problemEncountered(): void {
        basic.showIcon(IconNames.Skull)
    }
}