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
    do_start_task(old_stack)
  }
});

