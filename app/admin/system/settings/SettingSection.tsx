// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type React from 'react';

import { CheckboxElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';

import type { Setting } from '@lib/Settings';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { updateSettings } from './SettingActions';

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
     * Icon to display in the section header.
     */
    icon?: React.ReactNode;

    /**
     * Description of the section.
     */
    description: string;

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
    const defaultValues: Record<string, boolean | number | string | string[] | undefined> = {};
    for (const { setting, defaultValue, value } of props.settings)
        defaultValues[setting] = value ?? defaultValue;

    return (
        <FormGridSection action={updateSettings} defaultValues={defaultValues}
                         icon={props.icon} title={props.title}>
            <Grid size={{ xs: 12 }}>
                <SectionIntroduction>
                    {props.description}
                </SectionIntroduction>
            </Grid>
            <Grid size={{ xs: 12 }}>
                <KeyValueList items={ props.settings.map((setting) => {
                    const key = setting.setting;
                    let value: React.ReactNode;
                    switch (setting.type) {
                        case 'boolean':
                            value = (
                                <CheckboxElement key={key} name={setting.setting} size="small" />
                            );
                            break;

                        case 'number':
                            value = (
                                <TextFieldElement key={key} name={setting.setting} type="number"
                                                  size="small" fullWidth />
                            );
                            break;

                        case 'string':
                            value = (
                                <TextFieldElement key={key} name={setting.setting} size="small"
                                                  fullWidth />
                            );
                            break;

                        case 'stringArray':
                        default:
                            throw new Error(`Unsupported setting type: ${setting.type}`);
                    }

                    return {
                        description: setting.description,
                        key: setting.label,
                        keyAlign: 'center',
                        value,
                        valueTemplate: 'component',
                    };

                }) } />
            </Grid>
        </FormGridSection>
    );
}
