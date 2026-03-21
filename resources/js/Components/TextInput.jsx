import { forwardRef } from 'react';

const TextInput = forwardRef(function TextInput({ type = 'text', style, ...props }, ref) {
    return <input ref={ref} type={type} style={style} {...props} />;
});

export default TextInput;
