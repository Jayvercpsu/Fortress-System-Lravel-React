export default function TextInput({ type = 'text', style, ...props }) {
    return <input type={type} style={style} {...props} />;
}
