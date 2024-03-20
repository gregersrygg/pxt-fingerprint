interface Uart {
    writeBuffer(buf: Buffer): void
    readBuffer(len: number): Buffer
}

class SerialUart implements Uart {
    constructor(rx: SerialPin, tx: SerialPin) {
        serial.setRxBufferSize(128)
        serial.redirect(tx, rx, BaudRate.BaudRate57600)
    }

    writeBuffer(buf: Buffer): void {
        serial.writeBuffer(buf)
    }

    readBuffer(len: number): Buffer {
        return serial.readBuffer(len)
    }
}
    
/**
 * Fingerprint blocks
 */
//% weight=100 color=#f81e96 icon="\uf577" block="Fingerprint"
namespace fingerprint {
    const DEBUG = false
    const HEADER_ID = 0xef01
    const DEFAULT_ADDR = 0xffffffff
    let uart: Uart

    interface SystemParameters {
        loaded: boolean
        statusReg: number
        systemId: number
        fingerLibSize: number
        secLevel: number
        devAddr: number
        dataPacketSize: number
        baudrate: number
    }
    let params: SystemParameters
    let inSimulator = false

    enum CMD {
        OK = 0x0,
        TAKE_IMG = 0x1,
        IMG2TZ = 0x2,
        SEARCH_FINGER = 0x4,
        CREATE_FINGER = 0x5, // generate template
        STORE_FINGER = 0x6, // store template
        READ_SYS_PARA = 0xf,
        EMPTY_ALL_FINGERS = 0xd,
        VERIFY_PWD = 0x13,
        FINGER_COUNT = 0x1d,
        LED_CONFIG = 0x35,
        HANDSHAKE = 0x40,
    }

    enum PID {
        CMD_PACKET = 0x1,
        DATA_PACKET = 0x2,
        ACK_PACKET = 0x7,
        END_DATA_PACKET = 0x8,
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
        FAILED_TO_COMBINE_CHARACTER_FILES = 0x0a,
        PAGEID_BEYOND_FINGER_LIB = 0x0b,
        ERROR_READING_TEMPLATE_OR_TEMPLATE_INVALID = 0x0c,
        ERROR_UPLOADING_TEMPLATE = 0x0d,
        ERROR_RECEIVING_DATA_PACKAGES = 0x0e,
        ERROR_UPLOADING_IMG = 0x0f,
        FAILED_TO_DELETE_TEMPLATE = 0x10,
        FAILED_TO_CLEAR_FINGER_LIB = 0x11,
        WRONG_PASSWORD = 0x13,
        FAILED_TO_GENERATE_IMG_NO_VALID_PRIMARY_IMG = 0x15,
        ERROR_WRITING_TO_FLASH = 0x18,
        NO_DEFINITION_ERROR = 0x19,
        INVALID_REGISTER_ERROR = 0x1a,
        INCORRECT_CONFIG_OF_REGISTER = 0x1b,
        WRONG_NOTEPAD_PAGE_NUM = 0x1c,
        FAILED_TO_OPERATE_COMMUNICATION_PORT = 0x1d,
    }

    enum ERR_MSG {
        ERROR_MISSING_ACK_VERIFY_PWD = 1,
        ERROR_RECEIVING_DATA_PACKET = 2,
        ERROR_NO_ACK_READ_PARAMS = 3,
        ERROR_READ_PARAMETERS = 4,
        ERROR_FINGER_COUNT = 5,
        ERROR_ADD_NEW_FINGER = 6,
        ERROR_TAKE_IMAGE = 7,
        ERROR_IMG2TZ = 8,
        ERROR_MISSING_ACK_LED = 9,
        ERROR_MISSING_ACK_COMMAND = 10,
        ERROR_UNEXPECTED_HEADER_ID = 11,
    }

    export function connect(rx: SerialPin, tx: SerialPin): void {
        params = {
            loaded: false,
            statusReg: 0,
            systemId: 0,
            fingerLibSize: 0,
            secLevel: 0,
            devAddr: 0,
            dataPacketSize: 0,
            baudrate: 0,
        }

        // At power on, it takes about 200ms for initialization
        basic.pause(250)
        uart = new SerialUart(rx, tx)
        // uart.setRxBufferSize(128)
        // uart.redirect(tx, rx, BaudRate.BaudRate57600)
        basic.pause(1000)

        if (DEBUG) {
            control.onEvent(DAL.MICROBIT_ID_SERIAL, DAL.MICROBIT_SERIAL_EVT_RX_FULL, function () {
                basic.showIcon(IconNames.Square)
            })
        }
    }

    export function setUart(u: Uart): void {
        uart = u
    }

    export function verifyPassword(): boolean {
        const dataBuf = pins.createBuffer(5)
        dataBuf.setNumber(NumberFormat.UInt8BE, 0, CMD.VERIFY_PWD);
        dataBuf.setNumber(NumberFormat.UInt32BE, 1, 0x00000000)
        
        tx(createTxBuf(PID.CMD_PACKET, dataBuf))

        const res = parseResponse()
        if (res.pid != PID.ACK_PACKET) {
            problemEncountered(ERR_MSG.ERROR_MISSING_ACK_VERIFY_PWD)
        }

        const code = res.code
        if (code == RET_CODE.EXECUTION_COMPLETE) {
            return true
        } else if (code == RET_CODE.WRONG_PASSWORD) {
            return false
        } else if (code == RET_CODE.ERROR_REC_DATA_PACKET) {
            problemEncountered(ERR_MSG.ERROR_RECEIVING_DATA_PACKET)
        } else {
            basic.showNumber(code)
        }
        return false
    }

    export function readParameters(): void {
        const dataBuf = pins.createBuffer(1)
        dataBuf.setNumber(NumberFormat.UInt8BE, 0, CMD.READ_SYS_PARA);
        tx(createTxBuf(PID.CMD_PACKET, dataBuf))

        const res = parseResponse()
        if (res.pid != PID.ACK_PACKET && !inSimulator) {
            problemEncountered(ERR_MSG.ERROR_NO_ACK_READ_PARAMS)
        }

        const code = res.code
        if (code != RET_CODE.EXECUTION_COMPLETE) {
            problemEncountered(ERR_MSG.ERROR_READ_PARAMETERS)
        }

        params.statusReg = res.data.getNumber(NumberFormat.UInt16BE, 0)
        params.systemId = res.data.getNumber(NumberFormat.UInt16BE, 2)
        params.fingerLibSize = res.data.getNumber(NumberFormat.UInt16BE, 4)
        params.secLevel = res.data.getNumber(NumberFormat.UInt16BE, 6)
        params.devAddr = res.data.getNumber(NumberFormat.UInt32BE, 8)
        params.dataPacketSize = res.data.getNumber(NumberFormat.UInt16BE, 12)
        params.baudrate = res.data.getNumber(NumberFormat.UInt16BE, 14) * 9600
    }

    export function fingerCount(): number {
        const buf = pins.createBuffer(1)
        buf.setNumber(NumberFormat.UInt8BE, 0, CMD.FINGER_COUNT)

        const response = command(buf)

        if (response.code != RET_CODE.EXECUTION_COMPLETE) {
            problemEncountered(ERR_MSG.ERROR_FINGER_COUNT)
        }

        return response.data.getNumber(NumberFormat.UInt16BE, 0)
    }

    export function emptyAllFingers(): void {
        simpleCommand(CMD.EMPTY_ALL_FINGERS)
    }

    export function addNewFinger(): number {
        let fingerCount = fingerprint.fingerCount()
        let code

        for (let i=1; i<=2; i++) {
            code = takeImage()
            switch (code) {
                case RET_CODE.EXECUTION_COMPLETE:
                    break
                case RET_CODE.NO_FINGER_ON_SENSOR:
                    basic.showString("No finger on sensor")
                    break
                case RET_CODE.FAILED_TO_ENROLL_FINGER:
                    basic.showString("Failed to take image")
                    break
                default:
                    problemEncountered(ERR_MSG.ERROR_ADD_NEW_FINGER)
            }

            code = image2Tz(i)
            if (code != RET_CODE.EXECUTION_COMPLETE) {
                basic.showString("Error img2tz: " + code)
                return code
            }
        }
        
        createFinger()
        return storeFinger(1, fingerCount + 1)
    }

    export function checkFinger(): number {
        let fingerCount = fingerprint.fingerCount()
        if (fingerCount == 0) {
            basic.showString("No fingers stored")
            return -1
        }

        let code = RET_CODE.NO_FINGER_ON_SENSOR
        while (code == RET_CODE.NO_FINGER_ON_SENSOR) {
            code = takeImage()
            switch (code) {
                case RET_CODE.EXECUTION_COMPLETE:
                    break
                case RET_CODE.NO_FINGER_ON_SENSOR:
                    basic.pause(1000)
                    continue
                case RET_CODE.FAILED_TO_ENROLL_FINGER:
                    basic.showString("Failed to take image")
                    // fallthrough
                default:
                    problemEncountered(ERR_MSG.ERROR_TAKE_IMAGE)
                    return -code
            }
        }

        code = image2Tz(1)
        if (code != RET_CODE.EXECUTION_COMPLETE) {
            problemEncountered(ERR_MSG.ERROR_IMG2TZ)
            return -code
        }

        let res = searchFinger(1, fingerCount)
        if (res.code == RET_CODE.EXECUTION_COMPLETE) {
            let id = res.data.getNumber(NumberFormat.UInt16BE, 0)
            //let score = res.data.getNumber(NumberFormat.UInt16BE, 2)
            //basic.showString("match: " + id)
            //basic.showString("score: " + score)
            return id
        } else {
            //basic.showString("err: " + res.code)
            return -res.code
        }
    }

    function takeImage(): number {
        const buf = pins.createBuffer(1)
        buf.setNumber(NumberFormat.UInt8BE, 0, CMD.TAKE_IMG)

        const res = command(buf)
        return res.code
    }

    function image2Tz(num: number): number {
        const buf = pins.createBuffer(2)
        buf.setNumber(NumberFormat.UInt8BE, 0, CMD.IMG2TZ)
        buf.setNumber(NumberFormat.UInt8BE, 1, num)

        const res = command(buf)
        return res.code
    }

    function createFinger(): number {
        const buf = pins.createBuffer(1)
        buf.setNumber(NumberFormat.UInt8BE, 0, CMD.CREATE_FINGER)

        const res = command(buf)
        return res.code
    }

    function storeFinger(num: number, id: number): number {
        const buf = pins.createBuffer(4)
        buf.setNumber(NumberFormat.UInt8BE, 0, CMD.STORE_FINGER)
        buf.setNumber(NumberFormat.UInt8BE, 1, num)
        buf.setNumber(NumberFormat.UInt16BE, 2, id)

        const res = command(buf)
        return res.code
    }

    function searchFinger(num: number, fingerCount: number): CommandResponse {
        const buf = pins.createBuffer(3)
        buf.setNumber(NumberFormat.UInt8BE, 0, CMD.SEARCH_FINGER)
        buf.setNumber(NumberFormat.UInt8BE, 1, num)
        buf.setNumber(NumberFormat.UInt16BE, 2, 0)
        buf.setNumber(NumberFormat.UInt16BE, 4, fingerCount)

        return command(buf)
    }
    
    export function led(controlCode: number, speed: number, colorIndex: number, count: number): boolean {
        const buf = pins.createBuffer(5)
        buf.setNumber(NumberFormat.UInt8BE, 0, CMD.LED_CONFIG)
        buf.setNumber(NumberFormat.UInt8BE, 1, controlCode)
        buf.setNumber(NumberFormat.UInt8BE, 2, speed)
        buf.setNumber(NumberFormat.UInt8BE, 3, colorIndex)
        buf.setNumber(NumberFormat.UInt8BE, 4, count)

        tx(createTxBuf(PID.CMD_PACKET, buf))

        const res = parseResponse()
        if (res.pid != PID.ACK_PACKET) {
            problemEncountered(ERR_MSG.ERROR_MISSING_ACK_LED)
        }

        // basic.showString("code: " + res.code)

        return res.code == RET_CODE.EXECUTION_COMPLETE
    }

    function simpleCommand(cmdCode: number): CommandResponse {
        const buf = pins.createBuffer(1)
        buf.setNumber(NumberFormat.UInt8BE, 0, cmdCode)

        return command(buf)
    }

    function command(buf: Buffer): CommandResponse {
        tx(createTxBuf(PID.CMD_PACKET, buf))

        const res = parseResponse()

        if (res.pid != PID.ACK_PACKET) {
            problemEncountered(ERR_MSG.ERROR_MISSING_ACK_COMMAND)
        }

        return res
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
        buf.setNumber(NumberFormat.UInt16BE, 0, HEADER_ID)
        buf.setNumber(NumberFormat.UInt32BE, 2, DEFAULT_ADDR)
        buf.setNumber(NumberFormat.UInt8BE, 6, pid)
        buf.setNumber(NumberFormat.UInt16BE, 7, dataLen)
        buf.write(9, data)

        let checksum = 0
        for (let i=6; i<bufLen-2; i++) {
            checksum += buf.getNumber(NumberFormat.UInt8BE, i)
        }

        buf.setNumber(NumberFormat.UInt16BE, 9 + data.length, checksum & 0xffff)

        return buf
    }

    function tx(bytes: Buffer): void {
        uart.writeBuffer(bytes)
    }

    interface CommandResponse {
        headerId: number,
        adder: number,
        pid: number,
        length: number,
        code: number,
        checksum: number,
        data: Buffer,
    }

    function parseResponse(): CommandResponse {
        const headerLen = 9
        const headerBuf = uart.readBuffer(headerLen)
        let res = {
            headerId: headerBuf.getNumber(NumberFormat.UInt16BE, 0),
            adder: headerBuf.getNumber(NumberFormat.UInt32BE, 2),
            pid: headerBuf.getNumber(NumberFormat.UInt8BE, 6),
            length: headerBuf.getNumber(NumberFormat.UInt16BE, 7),
            code: -1,
            checksum: 0,
            data: pins.createBuffer(0),
        }

        if (res.headerId == 0x0 && res.adder == 0x0) {
            inSimulator = true
        } else if (res.headerId != HEADER_ID) {
            problemEncountered(ERR_MSG.ERROR_UNEXPECTED_HEADER_ID)
        }
        
        const dataBuf = uart.readBuffer(res.length)
        res.code = dataBuf.getNumber(NumberFormat.UInt8BE, 0)
        res.checksum = dataBuf.getNumber(NumberFormat.UInt16BE, res.length - 2)
        
        if (res.length > 3) {
            res.data = dataBuf.slice(1, res.length - 3)
        }

        return res
    }

    function problemEncountered(code: number): void {
        while (true) {
            basic.showIcon(IconNames.Skull)
            basic.pause(500)
            // Look up message in ERR_MSG enum
            basic.showNumber(code)
            basic.pause(500)
        }
    }
}