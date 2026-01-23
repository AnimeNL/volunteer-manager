// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { ErrorPageClientReporter } from './ErrorPageClientReporter';
import { ExportLayout } from '@app/exports/[slug]/ExportLayout';
import { Markdown } from '@components/Markdown';
import { RegistrationContentContainer } from '@app/registration/RegistrationContentContainer';
import { RegistrationLayout } from './registration/RegistrationLayout';
import { determineEnvironment } from '@lib/Environment';
import { getAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { getStaticContent } from '@lib/Content';

/**
 * Title to display on the page detailing that a fatal error has occurred.
 */
const kFatalErrorTitle = 'Whoops! Something went very wrong…';

/**
 * Message to display on the page detailing that a fatal error has occurred.
 */
const kFatalErrorContent =
    'Something went very wrong and the page you requested is currently not available. Don\'t ' +
    'worry, it\'s not you, it\'s us. Please let us know that this happened, and we\'ll be happy ' +
    'to help out.';

/**
 * Props accepted by the ErrorPage component.
 */
interface ErrorPageProps {
    /**
     * The HTTP status code matching the error that was thrown.
     */
    statusCode: 401 | 403 | 404;
}

/**
 * Root component shown when an error has occurred, as indicated by the given status code in the
 * `props`. No detailed information is provided.
 */
export async function ErrorPage(props: ErrorPageProps) {
    const environment = await determineEnvironment();
    if (!environment) {
        return (
            <ExportLayout eventName="AnimeCon Volunteering Teams">
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h5">
                        {kFatalErrorTitle}
                    </Typography>
                    <Typography variant="body1" sx={{ textWrap: 'balance', py: 1 }}>
                        {kFatalErrorContent}
                    </Typography>
                </Paper>
            </ExportLayout>
        );
    }

    const { user } = await getAuthenticationContext();

    const content = await getStaticContent([ `errors/${props.statusCode}` ]) || {
        title: kFatalErrorTitle,
        markdown: kFatalErrorContent,
    };

    return (
        <RegistrationLayout environment={environment}>
            <RegistrationContentContainer title={content.title} user={user}>
                <Markdown sx={{ p: 2 }}>{content.markdown}</Markdown>
                <ErrorPageClientReporter statusCode={props.statusCode} />
            </RegistrationContentContainer>
        </RegistrationLayout>
    );
}
