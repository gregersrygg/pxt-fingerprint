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

const DEFAULT_PASSWORD = 0x0

function debug(msg: string) {
    console.log(msg)
}

interface Command {
    header: number, // 2 bytes
    adder: number, // 4 bytes
    pid: number, // 1 byte
    length: number, // 2 bytes
    instruction: number, // 1 byte
    data: Buffer // variable length
    checksum: number // 2 bytes
}

function parseCommand(buf: Buffer): Command {
    const dataLen = buf.getNumber(NumberFormat.UInt16BE, 7) - 3 // without instruction and checksum
    let cmd = {
        header: buf.getNumber(NumberFormat.UInt16BE, 0),
        adder: buf.getNumber(NumberFormat.UInt32BE, 2),
        pid: buf.getNumber(NumberFormat.UInt8BE, 6),
        length: buf.getNumber(NumberFormat.UInt16BE, 7),
        instruction: buf.getNumber(NumberFormat.UInt8BE, 9),
        data: buf.slice(10, dataLen),
        checksum: buf.getNumber(NumberFormat.UInt16BE, 10 + dataLen)
    }

    return cmd
}

class FingerprintSimulator implements Uart {
    responseBuffer: Buffer

    constructor() {
        this.responseBuffer = pins.createBuffer(0)
    }

    writeBuffer(buf: Buffer): void {
        const cmd = parseCommand(buf)
        printCommand(cmd)

        // TAKE_IMG
        // IMG2TZ
        // SEARCH_FINGER
        // CREATE_FINGER
        // STORE_FINGER
        // READ_SYS_PARA
        // EMPTY_ALL_FINGERS
        // VERIFY_PWD
        // FINGER_COUNT
        // LED_CONFIG
        // HANDSHAKE
        switch (cmd.instruction) {
            case CMD.TAKE_IMG:
                this.responseBuffer = okResponse(cmd)
                break
            case CMD.IMG2TZ:
                this.responseBuffer = okResponse(cmd)
                break
            case CMD.SEARCH_FINGER:
                this.responseBuffer = searchFinger(cmd)
                break
            case CMD.CREATE_FINGER:
                this.responseBuffer = createFinger(cmd)
                break
            case CMD.VERIFY_PWD:
                this.responseBuffer = verifyPassword(cmd)
                break
            case CMD.HANDSHAKE:
                this.responseBuffer = okResponse(cmd)
                break

        }
    }

    readBuffer(bytes: number): Buffer {
        const ret = this.responseBuffer.slice(0, bytes)
        this.responseBuffer.shift(bytes)
        return ret
    }
}

function calculateChecksum(buf: Buffer): number {
    let checksum = 0
    for (let i = 6; i < buf.length - 2; i++) {
        checksum += buf.getNumber(NumberFormat.UInt8BE, i)
    }
    return checksum & 0xffff
}

function createResponse(cmd: Command, data: Buffer): Buffer {
    debug("Simulating response")
    const response = pins.createBuffer(9 + data.length + 2)
    debug("Header: " + toHex(0xef01, 2))
    response.setNumber(NumberFormat.UInt16BE, 0, 0xef01)
    debug("Adder: " + toHex(cmd.adder, 4))
    response.setNumber(NumberFormat.UInt32BE, 2, cmd.adder)
    debug("PID: " + toHex(PID.ACK_PACKET, 1))
    response.setNumber(NumberFormat.UInt8BE, 6, PID.ACK_PACKET)
    debug("Length: " + (data.length + 2))
    response.setNumber(NumberFormat.UInt16BE, 7, data.length + 2) // including checksum
    let dataHex = []
    for (let i = 0; i < data.length; i++) {
        dataHex.push(toHex(data.getNumber(NumberFormat.UInt8BE, i), 1))
    }
    debug("Data: " + dataHex.join(" "))
    response.write(9, data)
    const checksum = calculateChecksum(response)
    debug("Checksum: " + toHex(checksum, 2))
    response.setNumber(NumberFormat.UInt16BE, response.length - 2, checksum)
    return response
}

function okResponse(cmd: Command): Buffer {
    const data = pins.createBuffer(1)
    data.setNumber(NumberFormat.UInt8BE, 0, RET_CODE.EXECUTION_COMPLETE)
    return createResponse(cmd, data)
}

function searchFinger(cmd: Command): Buffer {
    const bufferId = cmd.data.getNumber(NumberFormat.UInt8BE, 0)
    const startPage = cmd.data.getNumber(NumberFormat.UInt16BE, 1)
    const pageNum = cmd.data.getNumber(NumberFormat.UInt16BE, 3)

    const data = pins.createBuffer(5)
    data.setNumber(NumberFormat.UInt8BE, 0, RET_CODE.FAILED_TO_FIND_MATCHING_FINGER)
    data.setNumber(NumberFormat.UInt16BE, 1, 0x0)
    data.setNumber(NumberFormat.UInt16BE, 3, 0x0)
    return createResponse(cmd, data)
}

function createFinger(cmd: Command): Buffer {
    const data = pins.createBuffer(1)
    data.setNumber(NumberFormat.UInt8BE, 0, RET_CODE.EXECUTION_COMPLETE)
    return createResponse(cmd, data)
}

function verifyPassword(cmd: Command): Buffer {
    const data = pins.createBuffer(1)
    const userPassword = cmd.data.getNumber(NumberFormat.UInt32BE, 0)

    if (userPassword == DEFAULT_PASSWORD) {
        data.setNumber(NumberFormat.UInt8BE, 0, RET_CODE.EXECUTION_COMPLETE)
    } else {
        data.setNumber(NumberFormat.UInt8BE, 0, RET_CODE.WRONG_PASSWORD)
    }

    return createResponse(cmd, data)
}

function toHex(n: number, size: number): string {
    // convert number to hex string without using toString
    let hex = ""
    let nibble: number
    let hexChars = "0123456789abcdef"
    for (let i = 0; i < size * 2; i++) {
        nibble = n & 0xf
        hex = hexChars.charAt(nibble) + hex
        n = n >> 4
    }
    return "0x" + hex
}

function printCommand(cmd: Command) {
    debug("Command received")
    debug("Header: " + toHex(cmd.header, 2))
    debug("Adder: " + toHex(cmd.adder, 4))
    debug("PID: " + toHex(cmd.pid, 1))
    debug("Length: " + cmd.length)
    debug("Instruction: " + toHex(cmd.instruction, 1))

    let dataHex = []
    for (let i = 0; i < cmd.data.length; i++) {
        dataHex.push(toHex(cmd.data.getNumber(NumberFormat.UInt8BE, i), 1))
    }

    debug("Data: " + dataHex.join(" "))
    debug("Checksum: " + toHex(cmd.checksum, 2))
}
