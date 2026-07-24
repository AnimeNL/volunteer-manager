// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

const response = await fetch('http://127.0.0.1:3000/statusz');
if (!response.ok) {
    console.error(`Health check failed: ${response.statusText}`);
    process.exitCode = 1;  // failure

} else {
    const responseText = await response.text();
    const expectedText = `[${process.env.SOURCE_COMMIT?.substring(0, 7) || 'dev'}]`;

    if (!responseText.includes(expectedText)) {
        console.error('Build hash not found in the response.');
        process.exitCode = 1;  // failure

    } else {
        process.exitCode = 0;  // success
    }
}
