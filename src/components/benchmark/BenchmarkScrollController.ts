export class BenchmarkScrollController {
  private readonly _scrollContainer: HTMLElement;
  private readonly _scrollThumb: HTMLElement;
  private readonly _hoverContainer: HTMLElement;
  private _autoScrollTimer: number | null = null;
  private _activeScrollDirection: number = 0;
  private _isUserDragging: boolean = false;
  private _dragStartMouseY: number = 0;
  private _dragStartScrollTop: number = 0;

  constructor(
    scrollContainer: HTMLElement,
    scrollThumb: HTMLElement,
    hoverContainer: HTMLElement,
  ) {
    this._scrollContainer = scrollContainer;
    this._scrollThumb = scrollThumb;
    this._hoverContainer = hoverContainer;
  }

  public initialize(): void {
    this._setup_scroll_synchronization();
    this._setup_drag_interaction();
    this._setup_hover_auto_scroll();
  }

  private _setup_scroll_synchronization(): void {
    this._scrollContainer.addEventListener("scroll", () =>
      this._synchronize_thumb_position(),
    );

    requestAnimationFrame(() => this._synchronize_thumb_position());
  }

  private _synchronize_thumb_position(): void {
    const total_scroll_range =
      this._scrollContainer.scrollHeight - this._scrollContainer.clientHeight;

    if (total_scroll_range <= 0) {
      this._scrollThumb.style.display = "none";
      return;
    }

    this._scrollThumb.style.display = "block";

    this._apply_thumb_translation(total_scroll_range);
  }

  private _apply_thumb_translation(total_scroll_range: number): void {
    const track_height_limit = this._scrollContainer.clientHeight - 32;
    const thumb_element_height = this._scrollThumb.offsetHeight || 32;
    const available_track_span = track_height_limit - thumb_element_height;

    const scroll_percentage_ratio =
      this._scrollContainer.scrollTop / total_scroll_range;
    const vertical_translation = scroll_percentage_ratio * available_track_span;

    this._scrollThumb.style.transform = `translateY(${vertical_translation}px)`;
  }

  private _setup_drag_interaction(): void {
    this._scrollThumb.addEventListener("mousedown", (event) =>
      this._handle_drag_start(event),
    );

    window.addEventListener("mousemove", (event) =>
      this._handle_global_mouse_move(event),
    );

    window.addEventListener("mouseup", () => this._handle_drag_end());
  }

  private _handle_drag_start(event: MouseEvent): void {
    this._isUserDragging = true;
    this._dragStartMouseY = event.clientY;
    this._dragStartScrollTop = this._scrollContainer.scrollTop;

    this._stop_auto_scroll_loop();

    event.preventDefault();
    event.stopPropagation();
  }

  private _handle_global_mouse_move(event: MouseEvent): void {
    if (!this._isUserDragging) {
      return;
    }

    const mouse_delta_y = event.clientY - this._dragStartMouseY;
    const total_scroll_range =
      this._scrollContainer.scrollHeight - this._scrollContainer.clientHeight;

    const track_height_limit = this._scrollContainer.clientHeight - 32;
    const thumb_element_height = this._scrollThumb.offsetHeight || 32;
    const available_track_span = track_height_limit - thumb_element_height;

    if (available_track_span <= 0) {
      return;
    }

    const scroll_units_per_pixel = total_scroll_range / available_track_span;
    this._scrollContainer.scrollTop =
      this._dragStartScrollTop + mouse_delta_y * scroll_units_per_pixel;
  }

  private _handle_drag_end(): void {
    this._isUserDragging = false;
  }

  private _setup_hover_auto_scroll(): void {
    this._hoverContainer.addEventListener("mousemove", (event) =>
      this._evaluate_hover_scrolling(event),
    );

    this._hoverContainer.addEventListener("mouseleave", () =>
      this._stop_auto_scroll_loop(),
    );
  }

  private _evaluate_hover_scrolling(event: MouseEvent): void {
    if (this._isUserDragging || event.buttons !== 0) {
      this._stop_auto_scroll_loop();
      return;
    }

    const thumb_rectangle = this._scrollThumb.getBoundingClientRect();
    const is_inside_thumb_horizontally =
      event.clientX >= thumb_rectangle.left &&
      event.clientX <= thumb_rectangle.right;
    const is_inside_thumb_vertically =
      event.clientY >= thumb_rectangle.top &&
      event.clientY <= thumb_rectangle.bottom;

    if (!is_inside_thumb_horizontally || !is_inside_thumb_vertically) {
      this._stop_auto_scroll_loop();
      return;
    }

    this._determine_auto_scroll_direction(event, thumb_rectangle);
  }

  private _determine_auto_scroll_direction(
    event: MouseEvent,
    thumb_rectangle: DOMRect,
  ): void {
    const relative_y_in_thumb = event.clientY - thumb_rectangle.top;
    const activation_threshold = thumb_rectangle.height * 0.1;

    if (relative_y_in_thumb < activation_threshold) {
      this._start_auto_scroll_loop(-1);
    } else if (relative_y_in_thumb > thumb_rectangle.height - activation_threshold) {
      this._start_auto_scroll_loop(1);
    } else {
      this._stop_auto_scroll_loop();
    }
  }

  private _start_auto_scroll_loop(direction: number): void {
    if (this._activeScrollDirection === direction) {
      return;
    }

    this._stop_auto_scroll_loop();

    this._activeScrollDirection = direction;

    this._execute_auto_scroll_step();
  }

  private _execute_auto_scroll_step(): void {
    const scroll_animation_step = (): void => {
      if (this._activeScrollDirection === 0) {
        return;
      }

      this._scrollContainer.scrollTop += this._activeScrollDirection * 8;

      this._autoScrollTimer = requestAnimationFrame(scroll_animation_step);
    };

    this._autoScrollTimer = requestAnimationFrame(scroll_animation_step);
  }

  private _stop_auto_scroll_loop(): void {
    if (this._autoScrollTimer !== null) {
      cancelAnimationFrame(this._autoScrollTimer);
      this._autoScrollTimer = null;
    }

    this._activeScrollDirection = 0;
  }
}
