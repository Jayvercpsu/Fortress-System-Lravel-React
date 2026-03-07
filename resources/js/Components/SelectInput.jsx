export default function SelectInput({ style, children, ...props }) {
    return (
        <select style={style} {...props}>
            {children}
        </select>
    );
}
