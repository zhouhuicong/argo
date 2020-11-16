import * as kubernetes from 'argo-ui/src/models/kubernetes';
import {Observable, Subscription} from 'rxjs';

interface Resource {
    metadata: kubernetes.ObjectMeta;
}

const reconnectAfterMs = 3000;

/**
 * ListWatch allows you to start watching for changes, automatically reconnecting on error.
 *
 * Items are sorted by creation timestamp.
 */
export class RetryWatch<T extends Resource> {
    private readonly watch: (resourceVersion: string) => Observable<kubernetes.WatchEvent<T>>;
    private readonly onOpen: () => void;
    private readonly onItem: (event: kubernetes.WatchEvent<T>) => void;
    private readonly onError: (error: Error) => void;
    private lastResourceVersion: string;
    private subscription: Subscription;
    private timeout: any; // should be `number`

    constructor(
        watch: (resourceVersion: string) => Observable<kubernetes.WatchEvent<T>>,
        onOpen: () => void, //  called when watches (re-)established after error, so should clear any errors
        onEvent: (event: kubernetes.WatchEvent<T>) => void, // called whenever item is received,
        onError: (error: Error) => void
    ) {
        this.watch = watch;
        this.onOpen = onOpen;
        this.onItem = onEvent;
        this.onError = onError;
    }

    public start(resourceVersion: string) {
        this.stop();
        this.subscription = this.watch(resourceVersion).subscribe(
            next => {
                if (next) {
                    this.lastResourceVersion = next.object.metadata.resourceVersion;
                    this.onItem(next);
                } else {
                    this.onOpen();
                }
            },
            e => {
                clearTimeout(this.timeout);
                this.onError(e);
                this.timeout = setTimeout(() => this.start(this.lastResourceVersion || resourceVersion), reconnectAfterMs);
            }
        );
    }

    // You should almost always  invoke on component unload.
    public stop() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
}
