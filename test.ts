basic.showIcon(IconNames.Happy)
fingerprint.connect(SerialPin.P1, SerialPin.P0)

fingerprint.emptyAllFingers()
//fingerprint.verifyPassword()
//basic.showIcon(IconNames.House)
//fingerprint.readParameters()
//basic.showIcon(IconNames.Diamond)
//fingerprint.led(0, 0, 0, 0)

input.onButtonPressed(Button.A, function() {
    /*let count = fingerprint.fingerCount()
    if (count == 0) {
        basic.showString("No fingers stored")
        return
    }*/

    basic.showString("?")
    let id = fingerprint.checkFinger()
    if (id > 0) {
        basic.showIcon(IconNames.Yes)
    } else {
        basic.showIcon(IconNames.No)
    }
    basic.pause(1000)
    basic.clearScreen()
})

input.onButtonPressed(Button.B, function () {
    fingerprint.addNewFinger()
    let count = fingerprint.fingerCount()
    basic.showString("f " + count)
})