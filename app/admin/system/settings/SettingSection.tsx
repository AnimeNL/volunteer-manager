// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import React, { useCallback, useState } from 'react';

import { type FieldValues, FormContainer, CheckboxElement, TextFieldElement }
    from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import type { Setting } from '@lib/Settings';
import { Section } from '@app/admin/components/Section';
import { SubmitCollapse } from '../../components/SubmitCollapse';
import { callApi } from '@lib/callApi';

/**
 * Configuration for an individual setting. The values don't have to be provided in the definition,
 * rather they will be injected prior to the configuration sections being displayed.
 */
export type ConfigurableSetting = {
    setting: Setting;
    label: string;
    description?: string;
} & (
    { type: 'boolean'; defaultValue: boolean; value?: boolean; } |
    { type: 'number'; defaultValue: number; value?: number; } |
    { type: 'string'; defaultValue: string; value?: string; } |
    { type: 'stringArray'; defaultValue: string[]; value?: string[]; }
);

/**
 * Props accepted by the <SettingSection> component.
 */
interface SettingSectionProps {
    /**
     * Settings that should be displayed in this section.
     */
    settings: ConfigurableSetting[];

    /**
     * Title that should be given to this section.
     */
    title: string;
}

/**
 * The <SettingSection> component lists a number of settings that can be dynamically changed.
 */
export function SettingSection(props: SettingSectionProps) {
    const [ error, setError ] = useState<string>();
    const [ invalidated, setInvalidated ] = useState<boolean>(false);
    const [ loading, setLoading ] = useState<boolean>(false);

    const handleChange = useCallback(() => setInvalidated(true), [ /* no deps */ ]);
    const handleSubmit = useCallback(async (data: FieldValues) => {
        setLoading(true);
        setError(undefined);
        try {
            const settings: { setting: string, value: number | string }[] = [];
            for (const { setting } of Object.values(props.settings)) {
                if (typeof data[setting] === 'undefined')
                    throw new Error(`The "${setting}" setting does not have a value.`);

                settings.push({
                    setting,
                    value: data[setting],
                });
            }

            const response = await callApi('post', '/api/admin/update-settings', { settings });
            if (response.success)
                setInvalidated(false);
            else
                setError('Unable to save the settings to the database.');

        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ props.settings ]);

    const defaultValues: Record<string, boolean | number | string | string[] | undefined> = {};
    for (const { setting, defaultValue, value } of Object.values(props.settings))
        defaultValues[setting] = value ?? defaultValue;

    return (
        <FormContainer defaultValues={defaultValues} onSuccess={handleSubmit}>
            <Section title={props.title}>
                <Grid container spacing={2}>
                    { props.settings.map((setting, index) =>
                        <React.Fragment key={index}>
                            <Grid size={{ xs: 4 }}>
                                <Typography variant="subtitle2">
                                    {setting.label}
                                </Typography>
                                { !!setting.description &&
                                    <Typography variant="body2">
                                        {setting.description}
                                    </Typography> }
                            </Grid>
                            <Grid size={{ xs: 8 }} alignSelf="center">
                                { setting.type === 'boolean' &&
                                    <CheckboxElement name={setting.setting} size="small"
                                                     onChange={handleChange} /> }
                                { setting.type === 'number' &&
                                    <TextFieldElement name={setting.setting} type="number"
                                                      size="small" fullWidth
                                                      onChange={handleChange} /> }
                                { setting.type === 'string' &&
                                    <TextFieldElement name={setting.setting} size="small" fullWidth
                                                      onChange={handleChange} /> }
                            </Grid>
                        </React.Fragment> )}
                </Grid>
                <SubmitCollapse error={error} loading={loading} open={invalidated} />
            </Section>
        </FormContainer>
    );
}
