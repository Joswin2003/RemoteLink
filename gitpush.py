#!/usr/bin/env python3
import subprocess, sys, os

os.chdir("/home/joswin/.gemini/antigravity/scratch/remotelink")

def run(cmd):
    print(f"\n$ {' '.join(cmd)}")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.stdout: print(r.stdout)
    if r.stderr: print(r.stderr)
    return r.returncode

# Configure git identity if not set
subprocess.run(["git","config","user.email","joswin2003@gmail.com"], capture_output=True)
subprocess.run(["git","config","user.name","Joswin2003"], capture_output=True)

# Stage new files
run(["git","add","QUICKSTART.md","host.sh","host_internet.sh","policy.yaml","policy,yaml"])

# Show what's staged
run(["git","status"])

# Commit
code = run(["git","commit","-m","Add internet hosting scripts and quickstart guide\n\n- host.sh: ngrok-based internet tunnel\n- host_internet.sh: Cloudflare tunnel (no login needed)\n- QUICKSTART.md: Quick start guide for future reference"])
if code != 0:
    print("Nothing new to commit or commit failed.")

# Push
code = run(["git","push","origin","main"])
if code == 0:
    print("\n✅ Successfully pushed to GitHub!")
else:
    print("\n❌ Push failed. See error above.")
