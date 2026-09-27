export default function RequestLoader({ message }: { message: string }) {
    return (
        <div className="request-loader-overlay" role="status" aria-live="polite">
            <span className="request-loader-spinner" aria-hidden="true" />
            <strong>{message}</strong>
        </div>
    );
}