if (typeof window !== 'undefined') {
    var Module = {
        'noInitialRun': true,  // prevent calling main() on page load
        'instantiateWasm': (imps, cb) => {
            var _progress_label = document.createElement('label');
            var _progress_show = document.createElement('span');

            _progress_label.textContent = 'Fetching: ';
            _progress_show.textContent = '-- % (N/A)';

            _progress_label.appendChild(_progress_show);
            document.body.insertBefore(_progress_label, document.body.lastChild);

            // fetch wasm

            var xhr = new XMLHttpRequest();

            xhr.open('GET', '@MAGISKBOOT_WASM_NAME@.wasm', true);
            xhr.responseType = 'arraybuffer';
            xhr.onprogress = (ev) => {
                if (ev.lengthComputable) {
                    const pct = Math.floor(100 * (ev.loaded / ev.total));
                    _progress_show.textContent = `${pct} % (${ev.loaded} / ${ev.total})`;
                } else {
                    _progress_show.textContent = `-- % (${ev.loaded} / ?)`
                }
            };
            xhr.onload = async () => {
                var succeed = false;
                var wasm = null;

                if (xhr.status == 200) {
                    _progress_show.textContent = 'Take longer on slow devices';
                    _progress_label.textContent = 'Compiling: ';
                    _progress_label.appendChild(_progress_show);

                    try {
                        wasm = await WebAssembly.instantiate(xhr.response, imps);
                        succeed = true;
                    } catch (exc) {
                        _progress_show.textContent = exc.message;
                        _progress_label.textContent = 'WebAssembly Error: ';
                        _progress_label.appendChild(_progress_show);
                    }
                } else {
                    _progress_show.textContent = xhr.statusText;
                    _progress_label.textContent = 'Network Error: ';
                    _progress_label.appendChild(_progress_show);
                }

                xhr = null;

                if (succeed) {
                    // free
                    _progress_label.remove();
                    _progress_label = undefined;
                    _progress_show = undefined;

                    cb(wasm.instance);
                }
            };
            xhr.send();

            return {};
        },
        'preInit': () => {
            // bind stdout

            const _conout = document.createElement('textarea');
            const _dec = new TextDecoder();

            _conout.readOnly = true;
            _conout.style.fontFamily = 'monospace';
            _conout.style.width = '1024px';
            _conout.style.height = '768px';

            Module.TTY.stream_ops.write = (_, buff, off, len) => {
                const arr = buff.subarray(off, off + len);
                _conout.value += _dec.decode(arr);
                _conout.scrollTop = _conout.scrollHeight;

                return len;
            }
            document.body.insertBefore(_conout, document.body.firstChild);

            // exec ctrl

            const _status_label = document.createElement('label');
            const _status_show = document.createElement('span');
            window.onerror = (_) => {
                _status_show.textContent = 'Crashed';
            };

            const _cmdline_edit = document.createElement('input');
            _cmdline_edit.style.fontFamily = 'monospace';
            _cmdline_edit.placeholder = 'Arguments…';

            const _clear_btn = document.createElement('button');
            const _exec_btn = document.createElement('button');

            _clear_btn.textContent = 'Clear';
            _clear_btn.addEventListener('click', () => {
                _status_show.textContent = 'Ready';
                _conout.value = '';
            });

            _exec_btn.disabled = true;
            Module.onRuntimeInitialized = () => {
                // we can call main() now
                _status_show.textContent = 'Ready';
                _status_label.textContent = 'Status: ';
                _status_label.appendChild(_status_show);
                _exec_btn.disabled = false;
            };
            _exec_btn.textContent = 'Run';
            _exec_btn.addEventListener('click', () => {
                const args = _cmdline_edit.value.split(/\s+/);  // ws seperated args
                _conout.value += `\n### Arguments: ${_cmdline_edit.value} ###\n\n`;
                _cmdline_edit.value = '';

                _status_show.textContent = 'Running';
                const ex = Module.callMain(args);
                _status_show.textContent = `Exited (code ${ex})`;
            });

            document.body.insertBefore(_cmdline_edit, document.body.firstChild);
            document.body.insertBefore(_clear_btn, document.body.firstChild);
            document.body.insertBefore(_exec_btn, document.body.firstChild);
            document.body.insertBefore(_status_label, _conout.nextSibling);
        },
    };
}