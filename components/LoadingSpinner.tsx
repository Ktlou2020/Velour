interface Props {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const SIZE_MAP = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-4',
};

export default function LoadingSpinner({ size = 'md', color = '#DC143C' }: Props) {
  return (
    <div
      className={`${SIZE_MAP[size]} rounded-full border-t-transparent animate-spin`}
      style={{ borderColor: `${color}40`, borderTopColor: 'transparent', borderRightColor: color }}
      role="status"
      aria-label="Loading"
    />
  );
}
