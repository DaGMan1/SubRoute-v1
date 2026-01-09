# SSH Authentication Setup for SubRoute

**Last Updated**: 2026-01-09

---

## Overview

This repository uses a **dedicated SSH deploy key** for authentication to prevent conflicts with other GitHub projects (Alex, LHC, etc.). The SSH key is tied specifically to the SubRoute-v1 repository.

---

## Current Configuration

### SSH Key
- **Location**: `~/.ssh/subroute_deploy_key` (private key)
- **Public Key**: `~/.ssh/subroute_deploy_key.pub`
- **Type**: ED25519 (modern, secure)
- **Comment**: `subroute-deploy-key`
- **Passphrase**: None (for automation)

### SSH Config
**File**: `~/.ssh/config`

```ssh-config
# SubRoute-v1 repository specific config
Host github.com-subroute
    HostName github.com
    User git
    IdentityFile ~/.ssh/subroute_deploy_key
    IdentitiesOnly yes
```

**Explanation**:
- `Host github.com-subroute`: Custom alias to use for this repo only
- `IdentityFile`: Points to the dedicated SSH key
- `IdentitiesOnly yes`: Prevents SSH from trying other keys

### Git Remote
**Remote URL**: `git@github.com-subroute:DaGMan1/SubRoute-v1.git`

Note the custom host: `github.com-subroute` (not `github.com`)

**Check with**:
```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github"
git remote -v
```

---

## How It Works

1. **When you push to GitHub**:
   ```bash
   git push origin main
   ```

2. **Git looks at the remote URL**:
   ```
   git@github.com-subroute:DaGMan1/SubRoute-v1.git
   ```

3. **SSH checks ~/.ssh/config** for the host `github.com-subroute`

4. **SSH uses the dedicated key**: `~/.ssh/subroute_deploy_key`

5. **GitHub authenticates** using the deploy key configured in the repository settings

6. **Vercel detects the push** and triggers automatic deployment

---

## Verification Commands

### Test SSH Connection
```bash
ssh -T git@github.com-subroute
```

**Expected output**:
```
Hi DaGMan1/SubRoute-v1! You've successfully authenticated, but GitHub does not provide shell access.
```

### Check Git Configuration
```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github"
git remote -v
git config core.sshCommand  # Should be empty or not set
```

### View Public Key
```bash
cat ~/.ssh/subroute_deploy_key.pub
```

---

## GitHub Deploy Key Configuration

**Location**: https://github.com/DaGMan1/SubRoute-v1/settings/keys

**Settings**:
- **Title**: SubRoute Deploy Key
- **Key**: Contents of `~/.ssh/subroute_deploy_key.pub`
- **Allow write access**: ✅ Enabled (required for pushing)

---

## Troubleshooting

### Problem: "Permission denied (publickey)"
```bash
# Check if SSH key is loaded
ssh-add -l

# If not loaded, add it
ssh-add ~/.ssh/subroute_deploy_key

# Test connection
ssh -T git@github.com-subroute
```

### Problem: Push uses wrong GitHub account
```bash
# Verify remote URL uses custom host
cd "/Users/garrymans/Documents/App Dev/SubRoute-github"
git remote -v

# Should show: git@github.com-subroute:DaGMan1/SubRoute-v1.git
# NOT: git@github.com:DaGMan1/SubRoute-v1.git

# If wrong, fix it:
git remote set-url origin git@github.com-subroute:DaGMan1/SubRoute-v1.git
```

### Problem: Conflicts with other projects
The whole point of this setup is to AVOID conflicts! Each project can have its own SSH key:

```ssh-config
# ~/.ssh/config

# SubRoute project
Host github.com-subroute
    HostName github.com
    IdentityFile ~/.ssh/subroute_deploy_key
    IdentitiesOnly yes

# Alex project
Host github.com-alex
    HostName github.com
    IdentityFile ~/.ssh/alex_deploy_key
    IdentitiesOnly yes

# Default GitHub (for other projects)
Host github.com
    HostName github.com
    IdentityFile ~/.ssh/id_ed25519
```

---

## Why This Setup?

**Problem**: Multiple GitHub accounts/projects cause authentication conflicts
**Solution**: Dedicated SSH keys per project with custom host aliases

**Benefits**:
1. ✅ No interference with other projects (Alex, LHC, etc.)
2. ✅ Specific key for specific repo (better security)
3. ✅ Easy to revoke if compromised (just delete deploy key on GitHub)
4. ✅ Works seamlessly with Vercel auto-deployment

---

## DO NOT

❌ Do NOT delete `~/.ssh/subroute_deploy_key`
❌ Do NOT change the remote URL back to `git@github.com:...`
❌ Do NOT add a passphrase to the key (breaks automation)
❌ Do NOT share the private key (`subroute_deploy_key`)
✅ DO share the public key (`.pub` file) if needed

---

## Quick Reference

### Standard Git Workflow
```bash
cd "/Users/garrymans/Documents/App Dev/SubRoute-github"
git add .
git commit -m "fix: description"
git push origin main
# Auto-deploys to Vercel in 1-2 minutes
```

### SSH Key Fingerprint
```bash
ssh-keygen -lf ~/.ssh/subroute_deploy_key.pub
```

**Current fingerprint**: SHA256:QfwtmN4ekRo/BeVQmx6NcDpdinldliV6B4I8xqRkUjg

---

**Questions?** Check `docs/PROCESS-FLOW.md` for full development workflow.
