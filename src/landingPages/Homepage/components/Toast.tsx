interface ToastProps {
  message: string;
  visible: boolean;
}

export default function Toast({ message, visible }: ToastProps) {
  return (
    <div className={`toast${visible ? ' show' : ''}`}>
      <span className="dot" style={{ width: 7, height: 7, borderRadius: '50%' }} />
      <span>{message}</span>
    </div>
  );
}
