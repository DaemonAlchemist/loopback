param(
    [string]$WorkspaceName = "",
    [string]$TargetFile = ""
)

$code = @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class WinFocusHelper {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsZoomed(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    public const int SW_SHOW = 5;
    public const int SW_SHOWMAXIMIZED = 3;
    public const int SW_RESTORE = 9;
    public const byte VK_MENU = 0x12;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public static bool ActivateHwnd(IntPtr hWnd) {
        try {
            // ALT key press to bypass Windows OS foreground lock
            keybd_event(VK_MENU, 0, 0, 0);
            keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);

            // Preserve window state: only restore if minimized, keeping maximized state intact
            if (IsIconic(hWnd)) {
                if (IsZoomed(hWnd)) {
                    ShowWindowAsync(hWnd, SW_SHOWMAXIMIZED);
                } else {
                    ShowWindowAsync(hWnd, SW_RESTORE);
                }
            } else {
                // If already visible/open, do not change its size or state
                ShowWindowAsync(hWnd, SW_SHOW);
            }
            BringWindowToTop(hWnd);

            IntPtr foreHwnd = GetForegroundWindow();
            uint foreThread = 0;
            GetWindowThreadProcessId(foreHwnd, out foreThread);
            uint curThread = GetCurrentThreadId();

            if (foreThread != 0 && foreThread != curThread) {
                AttachThreadInput(curThread, foreThread, true);
                SetForegroundWindow(hWnd);
                SwitchToThisWindow(hWnd, true);
                AttachThreadInput(curThread, foreThread, false);
            } else {
                SetForegroundWindow(hWnd);
                SwitchToThisWindow(hWnd, true);
            }
            return true;
        } catch {
            return false;
        }
    }

    public static string FocusWindow(string keyword, string fileKeyword) {
        IntPtr bestMatch = IntPtr.Zero;
        string bestTitle = "";
        IntPtr fallbackMatch = IntPtr.Zero;
        string fallbackTitle = "";

        string kw = (keyword ?? "").ToLower().Trim();
        string fkw = (fileKeyword ?? "").ToLower().Trim();

        EnumWindows((hWnd, lParam) => {
            var sb = new StringBuilder(512);
            int len = GetWindowText(hWnd, sb, 512);
            if (len > 0) {
                string title = sb.ToString();
                string titleLower = title.ToLower();

                // Skip dummy utility windows
                if (title == "CiceroUIWndFrame" || title == "Default IME" || title == "MSCTFIME UI") {
                    return true;
                }

                uint pid = 0;
                GetWindowThreadProcessId(hWnd, out pid);

                bool isAntigravity = titleLower.Contains("antigravity");
                if (!isAntigravity) {
                    try {
                        var proc = Process.GetProcessById((int)pid);
                        if (proc != null && proc.ProcessName.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0) {
                            isAntigravity = true;
                        }
                    } catch {}
                }

                if (isAntigravity) {
                    bool matchesKeyword = !string.IsNullOrEmpty(kw) && titleLower.Contains(kw);
                    bool matchesFile = !string.IsNullOrEmpty(fkw) && titleLower.Contains(fkw);

                    if (matchesKeyword || matchesFile) {
                        bestMatch = hWnd;
                        bestTitle = title;
                        return false; // Stop enumeration
                    }

                    if (fallbackMatch == IntPtr.Zero && (titleLower.Contains("antigravity") || IsWindowVisible(hWnd))) {
                        fallbackMatch = hWnd;
                        fallbackTitle = title;
                    }
                }
            }
            return true;
        }, IntPtr.Zero);

        if (bestMatch != IntPtr.Zero) {
            ActivateHwnd(bestMatch);
            return "MATCH:" + bestTitle;
        }

        if (fallbackMatch != IntPtr.Zero) {
            ActivateHwnd(fallbackMatch);
            return "FALLBACK:" + fallbackTitle;
        }

        return "NONE";
    }
}
'@

try {
    Add-Type -TypeDefinition $code -Language CSharp -ErrorAction SilentlyContinue
} catch {}

$fileBase = ""
if ($TargetFile) {
    $fileBase = [System.IO.Path]::GetFileName($TargetFile)
}

$result = [WinFocusHelper]::FocusWindow($WorkspaceName, $fileBase)

if ($result -eq "NONE" -or $result -like "FALLBACK*") {
    # Try WScript.Shell AppActivate as secondary reinforcement
    try {
        $ws = New-Object -ComObject WScript.Shell
        if ($WorkspaceName) {
            $activated = $ws.AppActivate("$WorkspaceName - Antigravity")
            if (-not $activated) {
                $activated = $ws.AppActivate("$WorkspaceName")
            }
        }
        if (-not $activated) {
            $ws.AppActivate("Antigravity")
        }
    } catch {}
}

Write-Output $result
