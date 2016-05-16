// here we test that request.body can keep writing data while it's being handled by producer side
// and that response.body can keep writing data too while being received by the consumer side
// In a browser environment, because http rely on xmlhttprequest client side pushing is impossible