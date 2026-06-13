import { useEffect, useRef, useState,} from 'react';

interface RevealProps {
  children: any;
  className?: string;
  style?: any;
  id?: string;
}

export default function Reveal({ children, className = '', style, id }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { rootMargin: '0px 0px -8% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const classes = ['reveal', visible ? 'in' : '', className].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={classes} style={style} id={id}>
      {children}
    </div>
  );
}
