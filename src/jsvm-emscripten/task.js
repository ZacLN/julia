mergeInto(LibraryManager.library, {
  jl_set_fiber: function(ctx) {
    // The task died, so we don't need to record the
    // stack. Use JS exception handling to get us back
    // to the entry point.
    throw 'killed';
  },
  jl_swap_fiber: function(ctx) {
    assert(false, "Not implemented yet");
  },
  jl_start_fiber: function(lastt_ctx, ctx) {
    // Set new C stack
    old_stack = stackSave();
    // Stack grows down
    new_stack = HEAP32[ctx + 4 >> 2];
    stackRestore(new_stack);
    try {
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
    alert('Back in the main task');
    // Restore old C stack
    stackRestore(old_stack)
  }
});

