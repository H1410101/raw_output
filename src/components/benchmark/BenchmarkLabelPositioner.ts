export class BenchmarkLabelPositioner {
  private readonly _scrollContainer: HTMLElement;

  constructor(scrollContainer: HTMLElement) {
    this._scrollContainer = scrollContainer;
  }

  public initialize(): void {
    this._scrollContainer.addEventListener("scroll", () =>
      this._update_all_label_positions(),
    );

    this._update_all_label_positions();
  }

  private _update_all_label_positions(): void {
    const labels = this._scrollContainer.querySelectorAll(
      ".vertical-text",
    ) as NodeListOf<HTMLElement>;

    const container_rectangle = this._scrollContainer.getBoundingClientRect();

    labels.forEach((label) => {
      this._update_single_label_position(label, container_rectangle);
    });
  }

  private _update_single_label_position(
    label: HTMLElement,
    container_rectangle: DOMRect,
  ): void {
    const label_track = label.parentElement;

    if (!label_track) {
      return;
    }

    const track_rectangle = label_track.getBoundingClientRect();

    if (this._is_track_smaller_than_label(track_rectangle, label)) {
      this._center_label_in_track(label);

      return;
    }

    this._stick_label_to_visible_center(
      label,
      track_rectangle,
      container_rectangle,
    );
  }

  private _is_track_smaller_than_label(
    track_rectangle: DOMRect,
    label: HTMLElement,
  ): boolean {
    return track_rectangle.height <= label.offsetHeight;
  }

  private _center_label_in_track(label: HTMLElement): void {
    label.style.top = "50%";
  }

  private _stick_label_to_visible_center(
    label: HTMLElement,
    track_rectangle: DOMRect,
    container_rectangle: DOMRect,
  ): void {
    const visible_top_edge = Math.max(
      track_rectangle.top,
      container_rectangle.top,
    );

    const visible_bottom_edge = Math.min(
      track_rectangle.bottom,
      container_rectangle.bottom,
    );

    const visible_height = Math.max(0, visible_bottom_edge - visible_top_edge);

    const visible_center_y = visible_top_edge + visible_height / 2;

    const relative_center_in_track = visible_center_y - track_rectangle.top;

    this._apply_clamped_label_position(
      label,
      relative_center_in_track,
      track_rectangle.height,
    );
  }

  private _apply_clamped_label_position(
    label: HTMLElement,
    target_y_position: number,
    track_height: number,
  ): void {
    const label_half_height = label.offsetHeight / 2;

    const minimum_top_offset = label_half_height;

    const maximum_top_offset = track_height - label_half_height;

    const clamped_top_value = Math.max(
      minimum_top_offset,
      Math.min(maximum_top_offset, target_y_position),
    );

    label.style.top = `${clamped_top_value}px`;
  }
}
