"use strict";

export class CommandManager {
    constructor() {
        this.history = [];
        this.redoStack = [];
    }

    execute(command) {
        command.execute();
        this.history.push(command);
        this.redoStack = []; // Limpiar rehacer al ejecutar una nueva acción
    }

    undo() {
        if (this.history.length === 0) return;
        const command = this.history.pop();
        command.undo();
        this.redoStack.push(command);
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const command = this.redoStack.pop();
        command.execute();
        this.history.push(command);
    }
}

// Comando concreto para agregar un movimiento
export class AddMovementCommand {
    constructor(model, movimiento) {
        this.model = model;
        this.movimiento = movimiento;
    }
    execute() {
        this.model._addMovimientoSilencioso(this.movimiento);
    }
    undo() {
        this.model._removeMovimientoSilencioso(this.movimiento.id);
    }
}