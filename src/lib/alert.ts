export type AlertType = 'info' | 'error' | 'success';

export type AlertOptions = {
  message: string;
  title?: string;
  type?: AlertType;
};

type AlertListener = (options: AlertOptions) => void;

let alertListener: AlertListener | null = null;

/**
 * Register a listener function to handle showing alert popups.
 * Typically registered in the root layout components.
 */
export const registerAlertListener = (listener: AlertListener) => {
  alertListener = listener;
  return () => {
    if (alertListener === listener) {
      alertListener = null;
    }
  };
};

/**
 * Show a beautiful custom popup alert.
 * 
 * @param message The main body text of the alert
 * @param title Optional title (defaults to "ALERT")
 * @param type Optional type ('info' | 'error' | 'success')
 */
export const showAlert = (
  message: string,
  title: string = 'ALERT',
  type: AlertType = 'info'
) => {
  if (alertListener) {
    alertListener({ message, title, type });
  } else {
    console.warn(`[Alert Service] Listener not registered yet. Msg: "${message}"`);
    // Fallback in case the UI layer isn't mounted yet
    if (typeof alert !== 'undefined') {
      alert(`${title}\n\n${message}`);
    }
  }
};
