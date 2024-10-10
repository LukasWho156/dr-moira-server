class UndoSystem {
    level;
    initialState;
    currentSnapshot;
    constructor(level) {
        this.level = level;
        this.initialState = level.takeSnapshot();
        this.currentSnapshot = {
            initialState: this.initialState,
            history: [],
            redoStack: [],
        };
    }
    revertToSnapshot = (snapshot) => {
        this.currentSnapshot = snapshot;
        this.level.revertToState(snapshot.initialState);
        for (const step of snapshot.history) {
            this.level.processInput(step, true);
        }
    };
    do = (input) => {
        const success = this.level.processInput(input, false);
        if (!success) {
            return false;
        }
        this.currentSnapshot.history.push(input);
        this.currentSnapshot.redoStack.splice(0, this.currentSnapshot.redoStack.length);
        this.currentSnapshot.next = null;
        return true;
    };
    undo = () => {
        if (this.currentSnapshot.history.length === 0) {
            if (!this.currentSnapshot.prev) {
                return false;
            }
            this.revertToSnapshot(this.currentSnapshot.prev);
            return true;
        }
        const undoStep = this.currentSnapshot.history.pop();
        this.currentSnapshot.redoStack.push(undoStep);
        this.revertToSnapshot(this.currentSnapshot);
        return true;
    };
    redo = () => {
        if (this.currentSnapshot.redoStack.length === 0) {
            if (!this.currentSnapshot.next) {
                return false;
            }
            this.revertToSnapshot(this.currentSnapshot.next);
            return true;
        }
        const redoStep = this.currentSnapshot.redoStack.pop();
        this.currentSnapshot.history.push(redoStep);
        this.level.processInput(redoStep, true);
        return true;
    };
    restart = () => {
        const newSnapshot = {
            initialState: this.initialState,
            history: [],
            redoStack: [],
            prev: this.currentSnapshot,
        };
        this.currentSnapshot.next = newSnapshot;
        this.revertToSnapshot(newSnapshot);
    };
    currentHistory = () => {
        return [...this.currentSnapshot.history];
    };
}
export { UndoSystem };
