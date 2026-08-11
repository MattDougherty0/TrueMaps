/** Limit concurrent GeoJSON IPC/parse work during project open. */
type Task = () => Promise<void>;

const queue: Task[] = [];
let active = 0;
const MAX_CONCURRENT = 3;

function pump() {
	while (active < MAX_CONCURRENT && queue.length > 0) {
		const task = queue.shift()!;
		active += 1;
		void task().finally(() => {
			active -= 1;
			pump();
		});
	}
}

export function enqueueLayerLoad(task: Task): void {
	queue.push(task);
	pump();
}
