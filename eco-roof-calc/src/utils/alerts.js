import Swal from 'sweetalert2';

const SkYugSwal = Swal.mixin({
  background: '#37444B',
  color: '#FFFFFF',
  confirmButtonColor: '#F29A2E',
  cancelButtonColor: '#4A5A63',
  borderRadius: '8px',
});

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  background: '#37444B',
  color: '#FFFFFF',
  iconColor: '#F29A2E',
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

export const alerts = {
  success(title) { return Toast.fire({ icon: 'success', title }); },
  error(title) { return Toast.fire({ icon: 'error', title }); },
  info(title) { return Toast.fire({ icon: 'info', title }); },

  showError(title, text) { return SkYugSwal.fire(title, text, 'error'); },
  showWarning(title, text) { return SkYugSwal.fire(title, text, 'warning'); },

  confirmDelete(title, text = "Это действие нельзя отменить!") {
    return SkYugSwal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ff4d4f', 
      confirmButtonText: 'Да, удалить',
      cancelButtonText: 'Отмена'
    });
  },

  prompt(title, text, confirmBtnText = 'Далее') {
    return SkYugSwal.fire({
      title,
      text,
      input: 'text',
      showCancelButton: true,
      confirmButtonText: confirmBtnText,
      cancelButtonText: 'Отмена',
      inputValidator: (value) => {
        if (!value) return 'Поле не может быть пустым!';
      }
    });
  },

  promptSymbol(title, text) {
    return SkYugSwal.fire({
      title,
      text,
      input: 'text',
      showCancelButton: true,
      confirmButtonText: 'Добавить',
      cancelButtonText: 'Отмена',
      inputValidator: (value) => {
        if (!value) return 'Символ не может быть пустым!';
        if (!/^[a-zA-Z]+$/.test(value)) return 'Используйте только английские буквы!';
      }
    });
  }
};