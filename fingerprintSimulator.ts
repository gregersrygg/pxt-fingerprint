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

class FingerprintSimulator implements Uart {
    rxBuffer: Buffer

    constructor() {
        this.rxBuffer = pins.createBuffer(0)
    }

    writeBuffer(buf: Buffer): void {
        let response = pins.createBuffer(9)
        response.setNumber(NumberFormat.UInt16BE, 0, 0xef01)
        response.setNumber(NumberFormat.UInt32BE, 2, 0xffffffff)
        response.setNumber(NumberFormat.UInt8BE, 6, PID.ACK_PACKET)
        response.setNumber(NumberFormat.UInt16BE, 7, 0)
        this.rxBuffer = response
    }

    readBuffer(): Buffer {
        return this.rxBuffer
    }
}
