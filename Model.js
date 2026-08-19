var HID_AMP_RE = /&/g
var HID_LT_RE = /</g
var HID_GT_RE = />/g

function emptyStatus(message) {
  return {
    ok: false,
    installed: false,
    accessible: false,
    message: message || "",
    devices: [],
    adapters: []
  }
}

// HID identity is untrusted peripheral data. Escape so leftover RichText /
// AutoText / StyledText surfaces cannot treat a crafted name as markup.
function plainHidText(value) {
  if (value === undefined || value === null) return ""
  var text = String(value)
  if (text.indexOf("&") === -1 && text.indexOf("<") === -1 && text.indexOf(">") === -1)
    return text
  return text.replace(HID_AMP_RE, "&amp;").replace(HID_LT_RE, "&lt;").replace(HID_GT_RE, "&gt;")
}

function hidDisplayName(item, fallback) {
  var raw = ""
  if (item && item.name) raw = item.name
  else if (fallback !== undefined && fallback !== null) raw = fallback
  return plainHidText(raw)
}

function runtimeDir(xdgRuntimeDir, uid) {
  var dir = xdgRuntimeDir === undefined || xdgRuntimeDir === null ? "" : String(xdgRuntimeDir)
  if (dir !== "") return dir + "/omarchy-mx"
  return "/run/user/" + String(uid || "") + "/omarchy-mx"
}

function parseStatus(raw) {
  var text = String(raw || "").trim()
  if (text === "") return emptyStatus("No response from mxctl")
  try {
    var data = JSON.parse(text)
    return {
      ok: data.ok !== false,
      installed: data.installed === true,
      accessible: data.accessible === true,
      message: String(data.message || ""),
      lastError: String(data.lastError || ""),
      devices: Array.isArray(data.devices) ? data.devices : [],
      adapters: Array.isArray(data.adapters) ? data.adapters : []
    }
  } catch (e) {
    return emptyStatus("Failed to parse device status")
  }
}

function settingNames(aliases) {
  return aliases || []
}

function settingByNames(device, names) {
  var settings = device && device.settings ? device.settings : []
  var wanted = {}
  for (var i = 0; i < names.length; i++) wanted[String(names[i]).toLowerCase()] = true
  for (var j = 0; j < settings.length; j++) {
    var item = settings[j]
    if (item && wanted[String(item.name || "").toLowerCase()]) return item
  }
  return null
}

function settingValue(setting) {
  if (!setting) return undefined
  var value = setting.value
  if (value && typeof value === "object" && value.name !== undefined && value.id !== undefined)
    return value
  return value
}

function numericValue(setting, fallback) {
  var value = settingValue(setting)
  if (value && typeof value === "object" && value.id !== undefined) return Number(value.id)
  var n = Number(value)
  return isFinite(n) ? n : fallback
}

function boolValue(setting) {
  var value = settingValue(setting)
  if (value && typeof value === "object" && value.id !== undefined) return Number(value.id) !== 0
  return value === true || value === 1 || value === "true"
}

function choiceName(setting) {
  var value = settingValue(setting)
  if (value && typeof value === "object" && value.name) return String(value.name)
  if (setting && setting.display) return String(setting.display)
  return value === undefined || value === null ? "" : String(value)
}

function choiceId(setting) {
  var value = settingValue(setting)
  if (value && typeof value === "object" && value.id !== undefined) return String(value.id)
  return value === undefined || value === null ? "" : String(value)
}

function hostActiveIndex(device) {
  var setting = settingByNames(device, ["change-host", "change_host"])
  if (!setting) return -1
  var value = settingValue(setting)
  if (value && typeof value === "object" && value.id !== undefined) return Number(value.id)
  var n = Number(value)
  return isFinite(n) ? n : -1
}

function isMouse(device) {
  if (!device) return false
  var kind = String(device.kind || "").toLowerCase()
  if (kind === "mouse" || kind === "trackball" || kind === "touchpad") return true
  return /master|mouse|anywhere|vertical|lift|ergo|trackball/.test(String(device.name || "").toLowerCase())
}

function isKeyboard(device) {
  if (!device) return false
  var kind = String(device.kind || "").toLowerCase()
  if (kind.indexOf("key") !== -1) return true
  return /key|mechanical/.test(String(device.name || "").toLowerCase())
}

function deviceMatches(device, needle) {
  if (!device || needle === undefined || needle === null || String(needle) === "") return false
  var want = String(needle).toLowerCase()
  var keys = [device.id, device.unitId, device.serial, device.path, device.name, device.codename]
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] !== undefined && keys[i] !== null && String(keys[i]).toLowerCase() === want) return true
  }
  if (device.path && String(device.path).split("/").pop().toLowerCase() === want) return true
  return false
}

function pickDefaultDevice(devices, preferredId, userPicked) {
  var list = Array.isArray(devices) ? devices : []
  if (preferredId) {
    for (var i = 0; i < list.length; i++) {
      if (deviceMatches(list[i], preferredId)) {
        if (userPicked === true || !isKeyboard(list[i])) return list[i]
        break
      }
    }
  }
  for (var j = 0; j < list.length; j++) if (isMouse(list[j]) && list[j].online !== false) return list[j]
  for (var k = 0; k < list.length; k++) if (list[k].online !== false) return list[k]
  return list.length > 0 ? list[0] : null
}

function isWritableDevice(device) {
  return !!(device && device.readonly !== true && device.online !== false && (device.settings || []).length > 0)
}

function batteryPercent(device) {
  if (!device) return -1
  var battery = device.battery
  if (battery && typeof battery.level === "number" && isFinite(battery.level)) return Math.round(battery.level)
  if (typeof device.bluetoothBattery === "number" && isFinite(device.bluetoothBattery))
    return Math.round(device.bluetoothBattery * 100)
  return -1
}

function batteryLabel(device) {
  var percent = batteryPercent(device)
  if (percent >= 0) return percent + "%"
  if (device && device.battery && device.battery.text) return plainHidText(device.battery.text)
  return ""
}

function batteryLow(device) {
  var percent = batteryPercent(device)
  return percent >= 0 && percent <= 20
}

function connectionLabel(device) {
  if (!device) return ""
  var value = String(device.connection || device.kind || "").toLowerCase()
  if (value === "bluetooth") return "Bluetooth"
  if (value === "usb") return "USB"
  if (value === "bolt") return "Bolt"
  if (value === "unifying") return "Unifying"
  if (value === "lightspeed") return "Lightspeed"
  if (value === "nano") return "Nano"
  if (value === "receiver") return "2.4 GHz"
  if (device.online === false) return "Offline"
  return device.protocol || "HID++"
}

function kindIcon(device) {
  if (isKeyboard(device)) return "󰌌"
  if (isMouse(device)) return "󰍽"
  return "󰐪"
}

function smartShiftState(setting) {
  if (!setting) return { on: false, threshold: 20, hasThreshold: false }
  if (setting.kind === "toggle") return { on: boolValue(setting), threshold: 20, hasThreshold: false }
  if (setting.kind === "range") {
    var n = numericValue(setting, 20)
    return { on: n > 1, threshold: n, hasThreshold: true }
  }
  if (setting.kind === "choice") {
    var name = choiceName(setting).toLowerCase()
    var id = choiceId(setting)
    return {
      on: id === "2" || name.indexOf("ratchet") !== -1,
      threshold: 20,
      hasThreshold: false
    }
  }
  var value = setting.value
  if (value && typeof value === "object") {
    var first = value
    if (value["1"] !== undefined) first = value["1"]
    else {
      for (var key in value) { first = value[key]; break }
    }
    if (first && typeof first === "object") {
      return {
        on: first.on !== false && first.ratchet !== true,
        threshold: Number(first.threshold !== undefined ? first.threshold : 20),
        hasThreshold: first.threshold !== undefined
      }
    }
  }
  return { on: boolValue(setting), threshold: 20, hasThreshold: false }
}

function cloneValue(value) {
  if (value === null || value === undefined) return value
  if (typeof value !== "object") return value
  if (Array.isArray(value)) {
    var list = []
    for (var i = 0; i < value.length; i++) list.push(cloneValue(value[i]))
    return list
  }
  var copy = {}
  for (var key in value) copy[key] = cloneValue(value[key])
  return copy
}

function nextToggleValue(setting) {
  if (!setting) return true
  if (setting.kind === "choice") {
    var on = smartShiftState(setting).on
    var choices = setting.choices || []
    if (choices.length >= 2) {
      var pick = on ? choices[0] : choices[1]
      if (String(pick.name || "").toLowerCase().indexOf("free") !== -1 && on)
        pick = choices[0]
      if (String(pick.name || "").toLowerCase().indexOf("ratchet") !== -1 && !on)
        pick = choices[1]
      return pick && pick.id !== undefined ? pick.id : (on ? 1 : 2)
    }
    return on ? 1 : 2
  }
  return !boolValue(setting)
}

function patchedSettingValue(setting, value, key) {
  var item = cloneValue(setting)
  if (key !== undefined && key !== null && String(key) !== "" && item.keys) {
    for (var i = 0; i < item.keys.length; i++) {
      if (String(item.keys[i].key) === String(key)) {
        item.keys[i].value = value
        break
      }
    }
    return item
  }
  item.value = value
  if (value && typeof value === "object" && value.name) item.display = String(value.name)
  else item.display = String(value)
  return item
}

function scalar(value) {
  if (value && typeof value === "object") {
    if (value.id !== undefined) return String(value.id)
    if (value.name !== undefined) return String(value.name)
    if (value.value !== undefined) return scalar(value.value)
  }
  if (value === true || value === "true") return "true"
  if (value === false || value === "false") return "false"
  if (value === undefined || value === null) return ""
  return String(value)
}

function valuesMatch(left, right) {
  return scalar(left) === scalar(right)
}

function settingCurrentValue(device, name, key) {
  var setting = settingByNames(device, [name])
  if (!setting) return undefined
  if (key !== undefined && key !== null && String(key) !== "" && setting.keys) {
    for (var i = 0; i < setting.keys.length; i++) {
      if (String(setting.keys[i].key) === String(key)) return setting.keys[i].value
    }
  }
  return setting.value
}

function writeIsConfirmed(devices, write) {
  var list = Array.isArray(devices) ? devices : []
  for (var i = 0; i < list.length; i++) {
    if (!deviceMatches(list[i], write.device)) continue
    return valuesMatch(settingCurrentValue(list[i], write.name, write.key), write.value)
  }
  return false
}

function applyPendingWrites(devices, writes) {
  var next = devices
  var kept = []
  var now = Date.now()
  for (var i = 0; i < writes.length; i++) {
    var write = writes[i]
    if (!write || now - Number(write.ts || 0) > 4000) continue
    if (writeIsConfirmed(next, write)) continue
    next = patchDeviceSetting(next, write.device, write.name, write.value, write.key)
    kept.push(write)
  }
  return { devices: next, writes: kept }
}

function patchDeviceSetting(devices, deviceId, name, value, key) {
  var list = Array.isArray(devices) ? devices : []
  var next = []
  for (var i = 0; i < list.length; i++) {
    var device = cloneValue(list[i])
    if (deviceMatches(device, deviceId) && device.settings) {
      var settings = []
      for (var j = 0; j < device.settings.length; j++) {
        var setting = device.settings[j]
        if (setting && setting.name === name)
          settings.push(patchedSettingValue(setting, value, key))
        else
          settings.push(setting)
      }
      device.settings = settings
    }
    next.push(device)
  }
  return next
}

var SETTING_HELP = {
  "dpi": "How far the pointer travels, in 50 DPI steps from 200 to 8000. 8K is the sensor maximum (8000 DPI).",
  "dpi-extended": "How far the pointer travels. 8K is the sensor maximum when the device supports 8000 DPI.",
  "dpi_extended": "How far the pointer travels. 8K is the sensor maximum when the device supports 8000 DPI.",
  "report_rate": "How often the mouse reports movement, in Hz. 8K is 8000 Hz when the device supports it.",
  "report-rate": "How often the mouse reports movement, in Hz. 8K is 8000 Hz when the device supports it.",
  "report_rate_extended": "How often the mouse reports movement, in Hz. 8K is 8000 Hz when the device supports it.",
  "pointer_speed": "A software pointer-speed multiplier on top of the hardware DPI.",
  "pointer-speed": "A software pointer-speed multiplier on top of the hardware DPI.",
  "scroll-ratchet": "When on, the MagSpeed wheel clicks at slow speeds and free-spins when you scroll quickly. Off is always free-spin.",
  "smartshift": "When on, the MagSpeed wheel clicks at slow speeds and free-spins when you scroll quickly.",
  "smart-shift": "How fast you must scroll before the wheel leaves ratchet mode. Lower switches to free-spin sooner.",
  "hires-smooth-invert": "Flips the vertical wheel so rolling away from you scrolls the opposite direction.",
  "scroll-invert": "Flips the vertical wheel so rolling away from you scrolls the opposite direction.",
  "hires-smooth-resolution": "Sends finer scroll steps. Feels smoother in apps that support high-resolution scrolling.",
  "hires-scroll-mode": "Sends wheel motion as HID++ events so Solaar rules can handle them instead of normal scroll.",
  "thumb-scroll-invert": "Flips the side thumb wheel so rolling it one way scrolls the opposite direction.",
  "thumb-scroll-mode": "Sends thumb-wheel motion as HID++ events for Solaar rules instead of normal horizontal scroll.",
  "change-host": "Jump to another paired computer. Same action as the channel slider on the bottom of the device.",
  "change_host": "Jump to another paired computer. Same action as the channel slider on the bottom of the device.",
  "reprogrammable-keys": "Changes what this button sends. The first action in the list is the factory default.",
  "fn-swap": "When on, the F-keys send media and special actions by default. Hold Fn for F1–F12.",
  "fn_swap": "When on, the F-keys send media and special actions by default. Hold Fn for F1–F12.",
  "backlight": "Keyboard lighting on or off.",
  "backlight_level": "How bright the keyboard backlight is.",
  "backlight-level": "How bright the keyboard backlight is."
}

function choiceNumericValues(setting) {
  var choices = setting && setting.choices ? setting.choices : []
  var nums = []
  for (var i = 0; i < choices.length; i++) {
    var item = choices[i]
    var n = Number(item && item.id !== undefined ? item.id : (item && item.name !== undefined ? item.name : item))
    if (isFinite(n)) nums.push(n)
  }
  nums.sort(function(a, b) { return a - b })
  return nums
}

function sliderBounds(setting) {
  if (!setting) return { min: 0, max: 100, step: 1 }
  if (setting.kind === "range" && setting.min !== undefined && setting.min !== null)
    return { min: Number(setting.min), max: Number(setting.max), step: 1 }
  var nums = choiceNumericValues(setting)
  if (nums.length === 0) return { min: 0, max: 100, step: 1 }
  var step = nums.length > 1 ? nums[1] - nums[0] : 1
  return { min: nums[0], max: nums[nums.length - 1], step: step > 0 ? step : 1, values: nums }
}

function snapToChoices(setting, value) {
  var nums = choiceNumericValues(setting)
  if (nums.length === 0) return Math.round(value)
  var best = nums[0]
  var bestD = Math.abs(value - best)
  for (var i = 1; i < nums.length; i++) {
    var d = Math.abs(value - nums[i])
    if (d < bestD) {
      best = nums[i]
      bestD = d
    }
  }
  return best
}

function dpiPresets(setting) {
  var wanted = [400, 800, 1200, 1600, 3200, 8000]
  var nums = choiceNumericValues(setting)
  if (nums.length === 0) {
    var bounds = sliderBounds(setting)
    nums = []
    for (var n = bounds.min; n <= bounds.max; n += Math.max(1, bounds.step)) nums.push(n)
  }
  var have = {}
  for (var i = 0; i < nums.length; i++) have[nums[i]] = true
  var options = []
  for (var j = 0; j < wanted.length; j++) {
    if (!have[wanted[j]]) continue
    options.push({
      value: String(wanted[j]),
      label: wanted[j] >= 8000 ? "8K" : String(wanted[j])
    })
  }
  return options
}

function helpForSetting(setting, fallback) {
  if (setting && SETTING_HELP[setting.name]) return SETTING_HELP[setting.name]
  var desc = setting && setting.description ? String(setting.description).replace(/\s+/g, " ").trim() : ""
  if (desc) return desc
  return fallback || ""
}

function remainingSettings(device, usedNames) {
  var settings = device && device.settings ? device.settings : []
  var used = {}
  for (var i = 0; i < usedNames.length; i++) used[String(usedNames[i]).toLowerCase()] = true
  var result = []
  for (var j = 0; j < settings.length; j++) {
    var item = settings[j]
    if (!item || used[String(item.name || "").toLowerCase()]) continue
    if (item.kind === "toggle" || item.kind === "range" || item.kind === "choice") result.push(item)
  }
  return result
}

function keyRows(setting) {
  if (!setting || !setting.keys) return []
  return setting.keys
}

function optionLabel(option) {
  if (!option) return ""
  if (typeof option === "object") return String(option.label !== undefined ? option.label : option.name || option.value || "")
  return String(option)
}

function optionValue(option) {
  if (!option) return ""
  if (typeof option === "object") {
    if (option.value !== undefined) return String(option.value)
    if (option.id !== undefined) return String(option.id)
    if (option.name !== undefined) return String(option.name)
  }
  return String(option)
}

function choiceOptions(setting) {
  var choices = setting && setting.choices ? setting.choices : []
  var options = []
  for (var i = 0; i < choices.length; i++) {
    var item = choices[i]
    options.push({
      value: item && item.id !== undefined ? String(item.id) : String(item && item.name || item),
      label: item && item.name ? String(item.name) : String(item)
    })
  }
  return options
}

function hostOptions(device) {
  var hosts = device && device.hosts ? device.hosts : []
  var options = []
  if (hosts.length > 0) {
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i]
      options.push({
        value: String(host.index),
        label: host.name ? plainHidText(host.name) : ("Channel " + (Number(host.index) + 1)),
        tooltip: host.paired === false ? "Not paired" : ""
      })
    }
    return options
  }
  return [
    { value: "0", label: "1" },
    { value: "1", label: "2" },
    { value: "2", label: "3" }
  ]
}

function mergeBluetoothBattery(devices, btDevices) {
  var list = Array.isArray(devices) ? devices.slice() : []
  var blues = Array.isArray(btDevices) ? btDevices : []
  for (var i = 0; i < list.length; i++) {
    var device = list[i] || {}
    if (device.battery && typeof device.battery.level === "number") continue
    var name = String(device.name || "").toLowerCase()
    for (var j = 0; j < blues.length; j++) {
      var bt = blues[j]
      if (!bt || !bt.connected || !bt.batteryAvailable) continue
      var label = String(bt.deviceName || bt.name || "").toLowerCase()
      if (label && name && (label.indexOf(name) !== -1 || name.indexOf(label) !== -1)) {
        var copy = {}
        for (var key in device) copy[key] = device[key]
        copy.bluetoothBattery = Number(bt.battery)
        copy.battery = copy.battery || { level: Math.round(copy.bluetoothBattery * 100), status: "bluetooth", text: Math.round(copy.bluetoothBattery * 100) + "%" }
        list[i] = copy
        break
      }
    }
  }
  return list
}

if (typeof module !== "undefined") {
  module.exports = {
    parseStatus: parseStatus,
    settingByNames: settingByNames,
    isMouse: isMouse,
    isKeyboard: isKeyboard,
    pickDefaultDevice: pickDefaultDevice,
    batteryPercent: batteryPercent,
    batteryLabel: batteryLabel,
    smartShiftState: smartShiftState,
    remainingSettings: remainingSettings,
    plainHidText: plainHidText,
    hidDisplayName: hidDisplayName,
    runtimeDir: runtimeDir
  }
}
