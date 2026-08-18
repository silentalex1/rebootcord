import os
import builtins

proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY') or os.environ.get('ALL_PROXY')
if proxy:
    os.environ.setdefault('HTTPS_PROXY', proxy)
    os.environ.setdefault('HTTP_PROXY', proxy)
    os.environ.setdefault('ALL_PROXY', proxy)
    _orig_import = builtins.__import__
    _patched = set()

    def _import(name, globals=None, locals=None, fromlist=(), level=0):
        mod = _orig_import(name, globals, locals, fromlist, level)
        root = name.split('.')[0]
        if root == 'aiohttp' and 'aiohttp' not in _patched:
            _patched.add('aiohttp')
            try:
                import aiohttp
                _init = aiohttp.ClientSession.__init__
                def _session_init(self, *args, **kwargs):
                    kwargs.setdefault('trust_env', True)
                    return _init(self, *args, **kwargs)
                aiohttp.ClientSession.__init__ = _session_init
            except Exception:
                pass
        if root == 'discord' and 'discord' not in _patched:
            _patched.add('discord')
            try:
                import discord
                _client_init = discord.Client.__init__
                def _patched_init(self, *args, **kwargs):
                    kwargs.setdefault('proxy', proxy)
                    return _client_init(self, *args, **kwargs)
                discord.Client.__init__ = _patched_init
            except Exception:
                pass
        return mod

    builtins.__import__ = _import
