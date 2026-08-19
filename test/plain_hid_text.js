var Model = require("../Model.js")

var fails = 0

function check(name, got, want) {
  if (got !== want) {
    fails += 1
    console.error("FAIL " + name + ": got " + JSON.stringify(got) + " want " + JSON.stringify(want))
    return
  }
  console.log("ok " + name)
}

check("mx master", Model.plainHidText("MX Master 3S"), "MX Master 3S")
check("bolt receiver", Model.plainHidText("Bolt Receiver"), "Bolt Receiver")
check("unifying", Model.plainHidText("Unifying Receiver"), "Unifying Receiver")
check("empty", Model.plainHidText(""), "")
check("null", Model.plainHidText(null), "")
check("undefined", Model.plainHidText(undefined), "")
check("img tag", Model.plainHidText('<img src="https://evil">'), "&lt;img src=\"https://evil\"&gt;")
check("amp first", Model.plainHidText("A & B <C>"), "A &amp; B &lt;C&gt;")
check("display name", Model.hidDisplayName({ name: "MX Master 3S" }, "MX"), "MX Master 3S")
check("display fallback", Model.hidDisplayName({}, "Receiver"), "Receiver")
check("display missing", Model.hidDisplayName(null, "MX"), "MX")
check("display markup", Model.hidDisplayName({ name: '<img src="https://evil">' }, "MX"), "&lt;img src=\"https://evil\"&gt;")
check("battery percent", Model.batteryLabel({ battery: { level: 84 } }), "84%")
check("battery text markup", Model.batteryLabel({ battery: { text: '<img src="https://evil">' } }), "&lt;img src=\"https://evil\"&gt;")
check("runtime xdg", Model.runtimeDir("/run/user/1000", "999"), "/run/user/1000/omarchy-mx")
check("runtime fallback", Model.runtimeDir("", "1000"), "/run/user/1000/omarchy-mx")
check("runtime null xdg", Model.runtimeDir(null, "42"), "/run/user/42/omarchy-mx")

if (fails) {
  console.error(fails + " failed")
  process.exit(1)
}
console.log("all passed")
