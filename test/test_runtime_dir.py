import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_plain_hid_text import mxctl

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "mxctl.py"
SERVICE = ROOT / "Service.qml"
MODEL = ROOT / "Model.js"


class RuntimeDirTests(unittest.TestCase):
    def setUp(self):
        self.xdg = tempfile.mkdtemp(prefix="omarchy-mx-test-")
        self.old_xdg = os.environ.get("XDG_RUNTIME_DIR")
        os.environ["XDG_RUNTIME_DIR"] = self.xdg

    def tearDown(self):
        if self.old_xdg is None:
            os.environ.pop("XDG_RUNTIME_DIR", None)
        else:
            os.environ["XDG_RUNTIME_DIR"] = self.old_xdg
        shutil.rmtree(self.xdg, ignore_errors=True)

    def run_helper(self, *args, env=None):
        merged = os.environ.copy() if env is None else dict(env)
        return subprocess.run(
            ["python3", str(HELPER), *args],
            env=merged,
            capture_output=True,
            text=True,
        )

    def test_same_fallback_path_in_qml_and_python(self):
        self.assertEqual(mxctl.runtime_path("/run/user/1000", 999), "/run/user/1000/omarchy-mx")
        self.assertEqual(mxctl.runtime_path("", 1000), "/run/user/1000/omarchy-mx")
        self.assertEqual(mxctl.runtime_path(None, 42), "/run/user/42/omarchy-mx")
        self.assertEqual(
            mxctl.runtime_path(os.environ["XDG_RUNTIME_DIR"], os.getuid()),
            f"{self.xdg}/omarchy-mx",
        )

    def test_no_tmp_runtime_fallback(self):
        service = SERVICE.read_text(encoding="utf-8")
        python = HELPER.read_text(encoding="utf-8")
        model = MODEL.read_text(encoding="utf-8")
        self.assertNotIn("/tmp", service)
        self.assertNotIn("/var/tmp", service)
        self.assertNotIn("/tmp", model)
        self.assertNotIn("/tmp/omarchy-mx", python)
        self.assertIn('Model.runtimeDir(Quickshell.env("XDG_RUNTIME_DIR")', service)
        self.assertIn("write-cmd", service)
        self.assertNotIn("printf %s", service)
        self.assertNotIn("bash", service.split("function triggerUdev")[0])

    def test_runtime_dir_mode_0700(self):
        path = mxctl.runtime_dir()
        self.assertEqual(str(path), f"{self.xdg}/omarchy-mx")
        self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o700)

    def test_runtime_dir_cli_fallback(self):
        env = os.environ.copy()
        env.pop("XDG_RUNTIME_DIR", None)
        expected = f"/run/user/{os.getuid()}/omarchy-mx"
        self.assertEqual(mxctl.runtime_path(None, os.getuid()), expected)
        proc = self.run_helper("runtime-dir", env=env)
        self.assertNotIn("/tmp", proc.stdout)
        self.assertNotIn("/tmp", proc.stderr)
        if proc.returncode == 0:
            self.assertEqual(proc.stdout.strip(), expected)
        else:
            self.assertIn(expected, proc.stderr)

    def test_write_cmd_roundtrip(self):
        cmd = {"op": "set", "device": "abc", "setting": "dpi", "value": 800}
        proc = self.run_helper("write-cmd", json.dumps(cmd))
        self.assertEqual(proc.returncode, 0, proc.stderr)
        written = json.loads((Path(self.xdg) / "omarchy-mx" / "cmd.json").read_text(encoding="utf-8"))
        self.assertEqual(written["op"], "set")
        self.assertEqual(written["device"], "abc")
        self.assertEqual(written["value"], 800)

    def test_write_cmd_symlink_does_not_truncate(self):
        victim = Path(self.xdg) / "victim.txt"
        victim.write_text("keep-me\n", encoding="utf-8")
        runtime = Path(self.xdg) / "omarchy-mx"
        runtime.mkdir()
        cmd_path = runtime / "cmd.json"
        cmd_path.symlink_to(victim)
        proc = self.run_helper("write-cmd", json.dumps({"op": "refresh"}))
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(victim.read_text(encoding="utf-8"), "keep-me\n")
        self.assertTrue(cmd_path.is_file())
        self.assertFalse(cmd_path.is_symlink())
        self.assertEqual(json.loads(cmd_path.read_text(encoding="utf-8"))["op"], "refresh")

    def test_atomic_write_status_symlink_does_not_truncate(self):
        victim = Path(self.xdg) / "status-victim.txt"
        victim.write_text("keep-status\n", encoding="utf-8")
        runtime = mxctl.runtime_dir()
        status = runtime / "status.json"
        status.symlink_to(victim)
        mxctl.atomic_write(status, {"ok": True, "devices": []})
        self.assertEqual(victim.read_text(encoding="utf-8"), "keep-status\n")
        self.assertTrue(status.is_file())
        self.assertFalse(status.is_symlink())
        self.assertTrue(json.loads(status.read_text(encoding="utf-8"))["ok"])

    def test_cleanup_same_directory(self):
        proc = self.run_helper("write-cmd", json.dumps({"op": "refresh"}))
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertTrue((Path(self.xdg) / "omarchy-mx" / "cmd.json").exists())
        cleaned = self.run_helper("cleanup")
        self.assertEqual(cleaned.returncode, 0, cleaned.stderr)
        self.assertFalse((Path(self.xdg) / "omarchy-mx").exists())


if __name__ == "__main__":
    unittest.main()
