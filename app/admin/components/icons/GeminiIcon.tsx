// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';

/**
 * Coloured version of the Gemini logo, created by Gemini.
 */
export function GeminiIcon(props: SvgIconProps) {
    return (
        <SvgIcon viewBox="0 0 24 24" {...props}>
            <defs>
                <mask id="gemini_star_mask" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse"
                      x="1" y="1" width="22" height="22">
                    <path d="M11.9982 1c.2302 0 .4309.1575 .4871.3808a13.1672 13.1672 0 00.6766 1.9987c.7285 1.6923 1.7286 3.1734 2.9974 4.4416 1.269 1.2688 2.7501 2.2689 4.4417 2.9974a13.193 13.193 0 001.999.6766c.2233.0562.3808.2568.3808.4871 0 .2302-.1571.4309-.3808.4871a13.1665 13.1665 0 00-1.9987.6766c-1.6916 0.7285-3.1727 1.7286-4.4417 2.9974-1.2683 1.2688-2.2684 2.7501-2.9974 4.4417a13.1906 13.1906 0 00-.677 1.9989.5026.5026 0 01-.4868.3805c-.2302 0-.4305-.1571-.4868-.3808a13.1702 13.1702 0 00-.677-1.9986c-.7281-1.6916-1.728-3.1727-2.9967-4.4417-1.2688-1.2681-2.7499-2.2682-4.4416-2.9967a13.1906 13.1906 0 00-1.9989-.677.5026.5026 0 01-.3805-.4868c0-.2302.1575-.4305.3808-.4868a13.1669 13.1669 0 001.9986-.677c1.6916-.7282 3.1727-1.7283 4.4417-2.9967 1.2688-1.2683 2.2689-2.7493 2.997-4.4416a13.1902 13.1902 0 00.6766-1.9986A.5026.5026 0 0111.9982 1z" fill="#FFFFFF" />
                </mask>

                <filter id="blur0" x="-5.709" y="5.451" width="13.293" height="14.627" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation="0.8326" />
                </filter>
                <filter id="blur1" x="-4.077" y="-12.625" width="28.724" height="29.001" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation="4.0246" />
                </filter>
                <filter id="blur2" x="-6.032" y="5.037" width="26.892" height="30.771" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation="3.4215" />
                </filter>
                <filter id="blur3" x="-6.032" y="5.037" width="26.892" height="30.771" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation="3.4215" />
                </filter>
                <filter id="blur4" x="-5.717" y="6.232" width="26.986" height="27.586" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation="3.4215" />
                </filter>
                <filter id="blur5" x="11.097" y="-2.91" width="25.424" height="24.964" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation="3.2513" />
                </filter>
                <filter id="blur6" x="-12.059" y="-4.501" width="26.446" height="26.657" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation="2.9467" />
                </filter>
                <filter id="blur7" x="3.744" y="-1.019" width="26.697" height="26.244" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation="2.6315" />
                </filter>
                <filter id="blur8" x="5.599" y="-5.258" width="19.026" height="17.518" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation="2.3547" />
                </filter>
                <filter id="blur9" x="-4.255" y="-9.593" width="23.99" height="23.466" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation="1.9888" />
                </filter>
                <filter id="blur10" x="-3.795" y="8.096" width="18.785" height="17.455" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feGaussianBlur stdDeviation="2.462" />
                </filter>
            </defs>

            <g mask="url(#gemini_star_mask)">
                <g filter="url(#blur0)">
                    <path d="M-0.983 18.172c2.538.901 5.455-.789 6.516-3.775 1.061-2.986-.137-6.137-2.675-7.038-2.538-.901-5.455.789-6.516 3.775-1.06 2.987.138 6.137 2.675 7.038z" fill="#FFE432" />
                </g>
                <g filter="url(#blur1)">
                    <path d="M10.298 8.327c3.486 0 6.313-2.889 6.313-6.452s-2.827-6.452-6.313-6.452c-3.487 0-6.314 2.889-6.314 6.452s2.827 6.452 6.314 6.452z" fill="#FC413D" />
                </g>
                <g filter="url(#blur2)">
                    <path d="M7.84 28.96c3.64-.178 6.403-4.144 6.173-8.858-.23-4.715-3.368-8.393-7.008-8.215-3.64.178-6.403 4.144-6.173 8.859.23 4.714 3.368 8.392 7.008 8.214z" fill="#00B95C" />
                </g>
                <g filter="url(#blur3)">
                    <path d="M7.84 28.96c3.64-.178 6.403-4.144 6.173-8.858-.23-4.715-3.368-8.393-7.008-8.215-3.64.178-6.403 4.144-6.173 8.859.23 4.714 3.368 8.392 7.008 8.214z" fill="#00B95C" />
                </g>
                <g filter="url(#blur4)">
                    <path d="M11.484 26.11c3.051-1.857 3.867-6.084 1.824-9.451-2.043-3.36-6.173-4.577-9.224-2.72-3.051 1.857-3.867 6.085-1.824 9.451 2.044 3.36 6.174 4.577 9.224 2.72z" fill="#00B95C" />
                </g>
                <g filter="url(#blur5)">
                    <path d="M23.812 15.553c3.429 0 6.209-2.677 6.209-5.98 0-3.303-2.78-5.98-6.209-5.98s-6.209 2.677-6.209 5.98c0 3.303 2.78 5.98 6.209 5.98z" fill="#3186FF" />
                </g>
                <g filter="url(#blur6)">
                    <path d="M-3.422 14.858c3.158 2.401 7.771 1.648 10.303-1.683 2.533-3.33 2.026-7.978-1.131-10.379-3.158-2.401-7.771-1.648-10.303 1.683-2.533 3.33-2.026 7.978 1.131 10.379z" fill="#FBBC04" />
                </g>
                <g filter="url(#blur7)">
                    <path d="M12.768 18.407c3.769 2.591 8.765 1.87 11.158-1.613 2.394-3.482 1.279-8.404-2.49-10.995-3.769-2.591-8.765-1.87-11.158 1.613-2.394 3.482-1.279 8.404 2.49 10.995z" fill="#3186FF" />
                </g>
                <g filter="url(#blur8)">
                    <path d="M19.614 0.209c.959 1.304-.274 3.838-2.752 5.661-2.479 1.823-5.265 2.245-6.224.941-.959-1.304.273-3.839 2.752-5.662 2.478-1.823 5.265-2.245 6.224-.94z" fill="#749BFF" />
                </g>
                <g filter="url(#blur9)">
                    <path d="M11.751 6.451c3.833-3.556 5.148-8.371 2.937-10.753-2.21-2.383-7.11-1.432-10.943 2.124-3.833 3.556-5.148 8.37-2.938 10.753 2.21 2.383 7.11 1.432 10.944-2.124z" fill="#FC413D" />
                </g>
                <g filter="url(#blur10)">
                    <path d="M3.88 19.222c2.28 1.631 4.894 1.879 5.843.554.948-1.325-.13-3.721-2.41-5.352-2.28-1.631-4.894-1.879-5.842-.554-.949 1.325.13 3.721 2.41 5.352z" fill="#FFEE48" />
                </g>
            </g>
        </SvgIcon>
    );
}
