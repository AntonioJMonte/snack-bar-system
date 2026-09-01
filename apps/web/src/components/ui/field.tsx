import { cn } from '@/lib/cn';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border border-border-subtle bg-surface px-4 py-3 outline-none',
        'focus:border-brand disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-lg border border-border-subtle bg-surface px-4 py-3 outline-none',
        'focus:border-brand disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-medium', className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  invalid,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </Label>
      {children}
      {hint && (
        <p className={cn('mt-1 text-xs', invalid ? 'text-danger' : 'text-ink-muted')}>{hint}</p>
      )}
    </div>
  );
}
