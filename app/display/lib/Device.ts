// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventHandler } from 'react';

/**
 * Define the `globalThis.animeCon` property. This is injected in the WebView used to display the
 * Volunteer Manager on the AnimeCon Display devices, as a message port.
 */
declare namespace globalThis {
    let animeConEventListener: EventHandler<any>;
    let animeCon: EventTarget & {
        postMessage: (message: string) => void;
    };
}

/**
 * Waits for the given number of `ms`.
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Type of command that's being executed.
 */
type CommandType = 'default' | 'ip' | 'number' | 'string';

/**
 * Class that executes a particular command and waits for a result to become available. It supports
 * return types based on the type of result that's indicated in the constructor.
 */
class Command<ResultType = never> {
    #command: string;
    #commandType: CommandType;

    #executionResolver?: (value?: string) => void;

    constructor(command: string, commandType: CommandType) {
        this.#command = command;
        this.#commandType = commandType;
    }

    /**
     * Executes the `#command` over the existing `postMessage` connection, if any, until either an
     * `error` or `success` response is seen from the host.
     */
    public async execute(): Promise<[ boolean, ResultType | undefined ]> {
        const response = await new Promise<string | undefined>(resolve => {
            this.#executionResolver = resolve;
            globalThis.animeCon.postMessage(this.#command);
        });

        this.#executionResolver = undefined;

        if (!response || !response.startsWith('success'))
            return [ /* success= */ false, /* result= */ undefined ];

        const result = response.substring(8);

        switch (this.#commandType) {
            case 'default':
                return [ /* success= */ true, /* result= */ undefined ];

            case 'number':
                return [ /* success= */ true, parseInt(result, 10) as ResultType ]

            case 'string':
                return [ /* success= */ true, result as ResultType ];

            default:
                throw new Error(`Unrecognised command type: ${this.#commandType}`);
        }
    }

    /**
     * To be called when the given `message` is received while this command is top of stack.
     */
    public onMessage(message: string): void {
        this.#executionResolver?.(message);
    }

    /**
     * To be called when execution of this command has timed out.
     */
    public onTimeout(): void {
        this.#executionResolver?.();
    }
}

/**
 * The Device class contains the necessary functionality for the Volunteer Manager to interact with
 * the Display device. The Java-side driver app is implemented in the following repository:
 *
 * @see https://github.com/beverloo/volunteer-manager-display
 */
const kDeviceInstance = new class {
    constructor() {
        if (typeof globalThis.animeCon !== 'undefined') {
            if (typeof globalThis.animeConEventListener !== 'undefined') {
                globalThis.animeCon.removeEventListener(
                    'message', globalThis.animeConEventListener);
            }

            globalThis.animeConEventListener = (event: MessageEvent<string>) => {
                this.onMessage(event.data);
            };

            globalThis.animeCon.addEventListener('message', globalThis.animeConEventListener);
        }
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Returns whether our code is currently running on a Volunteer Manager Display device.
     */
    public isDevice(): boolean {
        return typeof globalThis.animeCon !== 'undefined';
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Returns the device's current brightness level, or `undefined` when it couldn't be determined.
     */
    public async getBrightness(): Promise<number | undefined> {
        const result = await this.executeTypedCommand<number>('brightness:get', 'number');
        return result[1];
    }

    /**
     * Updates the device's screen brightness to the given `brightness`, which must be a number
     * between 0 and 255. The screen will be updated immediately.
     */
    public async setBrightness(brightness: number): Promise<boolean> {
        if (brightness < 0 || brightness > 255)
            return false;

        return this.executeCommand(`brightness:${brightness}`);
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Enables Kiosk mode on the device. This will trap the user in the app.
     */
    public async enableKiosk(): Promise<boolean> {
        return this.executeCommand('kiosk:enable');
    }

    /**
     * Disables Kiosk mode on the device. The user will be able to leave the app again.
     */
    public async disableKiosk(): Promise<boolean> {
        return this.executeCommand('kiosk:disable');
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Disables the light on the device. They will turn off immediately.
     */
    public async disableLight(): Promise<boolean> {
        return await this.executeCommand('light:CLOSE:RED,GREEN,BLUE');
    }

    /**
     * Reconnects the light's serial port by closing the port, then re-opening it. It's fine for the
     * close operation to fail, however the success status of the open operation will be returned.
     */
    public async reconnectLightSerialPort(): Promise<boolean> {
        await this.executeCommand('light:close');
        return await this.executeCommand('light:open');
    }

    /**
     * Updates the device's light to the given colour, indicated by the `red`, `green` and `blue`
     * channels, each of which must be between 0 and 255.
     */
    public async setLightColour(red: number, green: number, blue: number): Promise<boolean> {
        if (red < 0 || green < 0 || blue < 0 || red > 255 || green > 255 || blue > 255)
            return false;

        return this.executeCommand(`lightset:${red},${green},${blue}`);
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Returns the device's current volume level, or `undefined` when it couldn't be determined.
     */
    public async getVolume(): Promise<number | undefined> {
        const result = await this.executeTypedCommand<number>('volume:get', 'number');
        return result[1];
    }

    /**
     * Updates the device's volume to the given `volume`, which must be a number between 0 and 255.
     */
    public async setVolume(volume: number): Promise<boolean> {
        if (volume < 0 || volume > 255)
            return false;

        return this.executeCommand(`volume:${volume}`);
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Reads the IP addresses that have been assigned to the network interfaces on the device, both
     * IPv4 and IPv6. Convenient for diagnostics.
     */
    public async getIpAddresses(): Promise<string[] | undefined> {
        const result = await this.executeTypedCommand<string>('ip', 'string');
        if (!result[0] || typeof result[1] !== 'string')
            return /* failure= */ undefined;

        return result[1].split(';');
    }

    // ---------------------------------------------------------------------------------------------

    #command: Command<any> | undefined = undefined;
    #commandStack: Promise<void> = Promise.resolve();

    /**
     * Executes the given `command`. Returns whether the host app confirmed that it was successful.
     */
    private async executeCommand(command: string): Promise<boolean> {
        const result = await this.executeTypedCommand<never>(command, 'default');
        return result[0];
    }

    /**
     * Executes the given `command`, which should be executed as `commandType`. Returns a boolean
     * indicating whether the host app confirmed that it was successful, and the return value.
     */
    private async executeTypedCommand<ResultType>(command: string, commandType: CommandType)
        : Promise<[ boolean, ResultType | undefined ]>
    {
        if (!this.isDevice())
            return [ /* success= */ false, /* result= */ undefined ];

        let commandResolver: (foo: [ boolean, ResultType | undefined ]) => void;
        const commandPromise = new Promise<[ boolean, ResultType | undefined ]>(resolve => {
            commandResolver = resolve;
        });

        this.#commandStack = this.#commandStack.then(async () => {
            const commandInstance = new Command<ResultType>(command, commandType);
            this.#command = commandInstance;

            const result = await commandInstance.execute();
            wait(/* timeoutMs= */ 1000).then(() => commandInstance.onTimeout());

            this.#command = undefined;
            commandResolver(result);
        });

        return commandPromise;
    }

    /**
     * Called when the given `message` has been received.
     */
    private onMessage(message: string): void {
        this.#command?.onMessage(message);
    }
};

/**
 * Export the instance as the default export, allowing it to be used like `import device from foo`.
 */
export default kDeviceInstance;
