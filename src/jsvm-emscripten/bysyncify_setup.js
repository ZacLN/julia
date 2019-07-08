Module.preRun.push(function() {
    Bysyncify.instrumentWasmExports = function (exports) { return exports; };
    Bysyncify.handleSleep = function (startAsync) {
        if (ABORT) return;
        Module['noExitRuntime'] = true;
        if (Bysyncify.state === Bysyncify.State.Normal) {
            // Prepare to sleep. Call startAsync, and see what happens:
            // if the code decided to call our callback synchronously,
            // then no async operation was in fact begun, and we don't
            // need to do anything.
            var reachedCallback = false;
            var reachedAfterCallback = false;
            task = get_current_task();
            startAsync(function(returnValue) {
            assert(!returnValue || typeof returnValue === 'number'); // old emterpretify API supported other stuff
            if (ABORT) return;
            Bysyncify.returnValue = returnValue || 0;
            reachedCallback = true;
            if (!reachedAfterCallback) {
                // We are happening synchronously, so no need for async.
                return;
            }
            initiate_schedule_task(task);
            });
            reachedAfterCallback = true;
            if (!reachedCallback) {
                deschedule_current_task();
            }
        } else if (Bysyncify.state === Bysyncify.State.Rewinding) {
            // Stop a resume.
            finish_schedule_task();
        } else {
            abort('invalid state: ' + Bysyncify.state);
        }
        return Bysyncify.returnValue;
        };
    });

function is_root_task() {
    return true;
}

function get_current_task() {
    return Module['_jl_get_current_task']();
}

function task_ctx_ptr(task) {
    return Module["_task_ctx_ptr"](task);
}

function deschedule_current_task() {
    lastt = Module['_deschedule_task']();
    ctx = task_ctx_ptr(lastt);
    stackPtr = stackSave();

    // Save the bottom of the C stack in the task context. It simultaneously
    // serves as the top of the bysyncify stack.
    HEAP32[ctx + 4 >> 2] = stackPtr;

    Bysyncify.state = Bysyncify.State.Unwinding;
    Module['_bysyncify_start_unwind'](ctx);
    if (Browser.mainLoop.func) {
        Browser.mainLoop.pause();
    }
}

function do_start_task(old_stack)
{
    try {
        // start_task is always the entry point for any task
        Module['_start_task']();
    } catch(e) {
        stackRestore(old_stack)
        if (e !== e+0 && e !== 'killed') throw e;
        return;
    }
    // Either unwind or normal exit. In either case, we're back at the main task
    if (Bysyncify.state === Bysyncify.State.Unwinding) {
        // We just finished unwinding for a sleep.
        Bysyncify.state = Bysyncify.State.Normal;
        Module['_bysyncify_stop_unwind']();
    }
    stackRestore(old_stack);
}

function initiate_schedule_task(task) {
    // Bysyncify doesn't touch the C stack or our global
    // state. Restore both eagerly.
    old_stack = stackSave();
    console.log('task: ' + task);
    ctx = task_ctx_ptr(task);
    stackRestore(HEAP32[ctx + 4 >> 2]);
    Module['_schedule_task'](task);

    Bysyncify.currData = ctx;
    Bysyncify.state = Bysyncify.State.Rewinding;
    Module['_bysyncify_start_rewind'](ctx);
    if (Browser.mainLoop.func) {
        Browser.mainLoop.resume();
    }
    do_start_task(old_stack)
}

function finish_schedule_task() {
    Bysyncify.state = Bysyncify.State.Normal;
    Module['_bysyncify_stop_rewind']();
}
