#' Add a combobox select input to a website
#'
#' Adds an input to select from the entered options,
#' allowing for multiple selection, dynamic filtering, and custom entries.
#'
#' @param label Label of the input for the user.
#' @param options A vector of options, the name of a variable from which to pull levels, or \code{"datasets"},
#' \code{"variables"}, \code{"ids"}, or \code{"palettes"} to select names of datasets, variables, entity ids, or
#' color palettes. If there is a map with overlay layers with properties, can also be \code{"overlay_properties"},
#' to select between properties.
#' @param default Which of the options to default to; either its index or value.
#' @param display A display version of the options.
#' @param id Unique ID of the element to be created.
#' @param ... Additional attributes to set on the input element.
#' @param strict Logical; if \code{FALSE}, allows arbitrary user input, rather than limiting input to the
#' option set.
#' @param numeric Logical; if \code{TRUE}, will treat all numeric inputs as custom values,
#' rather than as potential option indices.
#' @param search Logical; if \code{FALSE}, does not dynamically filter the option set on user input.
#' @param multi Logical; if \code{TRUE}, allows multiple options to be selected.
#' @param accordion Logical; if \code{TRUE}, option groups will be collapsible.
#' @param clearable Logical; if \code{TRUE}, adds a button to clear the selection.
#' @param note Text to display as a tooltip for the input.
#' @param group_feature Name of a measure or entity feature to use as a source of option grouping,
#' if \code{options} is \code{"variables"} or \code{"ids"}.
#' @param variable The name of a variable from which to get levels (overwritten by \code{depends}).
#' @param dataset The name of an included dataset, where \code{variable} should be looked for; only applies when
#' there are multiple datasets with the same variable name.
#' @param depends The ID of another input on which the options depend; this will take president over \code{dataset}
#' and \code{variable}, depending on this type of input \code{depends} points to.
#' @param dataview The ID of an \code{\link{input_dataview}}, used to filter the set of options, and potentially
#' specify dataset if none is specified here.
#' @param subset Determines the subset of options shown if \code{options} is \code{"ids"}; mainly \code{"filtered"}
#' (default) to apply all filters, including the current selection, or \code{"full_filter"} to apply all
#' feature and variable filters, but not the current selection. \code{"siblings"} is a special case given a selection,
#' which will show other IDs with the same parent.
#' @param selection_subset Subset to use when a selection is made; defaults to \code{"full_filter"}.
#' @param filters A list with names of \code{meta} entries (from \code{variable} entry in \code{\link{data_add}}'s
#' \code{meta} list), and values of target values for those entries, or the IDs of value selectors.
#' @param reset_button If specified, adds a button after the input element that will revert the selection
#' to its default; either \code{TRUE}, or text for the reset button's label.
#' @param button_class Class name to add to the reset button.
#' @param as.row Logical; if \code{TRUE}, the label and input are in separate columns within a row.
#' @param floating_label Logical; if \code{FALSE} or \code{as.row} is \code{TRUE}, labels are separate from
#' their inputs.
#' @seealso See \code{\link{input_select}} for a more standard select input, or \code{\link{input_text}}
#' for a free-form input.
#' @examples
#' \dontrun{
#' input_combobox("Options", c("a", "b"))
#' }
#' @return A character vector of the contents to be added.
#' @export

input_combobox <- function(
  label,
  options,
  default = -1,
  display = options,
  id = label,
  ...,
  strict = TRUE,
  numeric = FALSE,
  search = TRUE,
  multi = FALSE,
  accordion = FALSE,
  clearable = FALSE,
  note = NULL,
  group_feature = NULL,
  variable = NULL,
  dataset = NULL,
  depends = NULL,
  dataview = NULL,
  subset = "filtered",
  selection_subset = "full_filter",
  filters = NULL,
  reset_button = FALSE,
  button_class = NULL,
  as.row = FALSE,
  floating_label = TRUE
) {
  id <- gsub("\\s", "", id)
  a <- list(...)
  if (as.row) floating_label <- FALSE
  r <- c(
    '<div class="wrapper combobox-wrapper">',
    if (!floating_label)
      paste0(
        '<label id="',
        id,
        '-label" for="',
        id,
        '-input">',
        label,
        "</label>"
      ),
    paste0(
      '<div class="',
      paste(
        c(
          if (reset_button) "input-group",
          if (floating_label) "form-floating"
        ),
        collapse = " "
      ),
      '">'
    ),
    paste0(
      '<div class="auto-input form-select combobox combobox-component" data-autoType="combobox"',
      ' id="',
      id,
      '" ',
      if (is.character(options) && length(options) == 1)
        paste0('data-optionSource="', options, '"'),
      if (!is.null(default)) paste0(' data-default="', default, '"'),
      if (!is.null(note)) paste0(' aria-description="', note, '"'),
      if (!is.null(dataview)) paste0(' data-view="', dataview, '"'),
      if (!is.null(subset)) paste0(' data-subset="', subset, '"'),
      if (!is.null(selection_subset))
        paste0(' data-selectionsubset="', selection_subset, '"'),
      if (!is.null(depends)) paste0(' data-depends="', depends, '"'),
      if (!is.null(dataset)) paste0(' data-dataset="', dataset, '"'),
      if (!is.null(variable)) paste0(' data-variable="', variable, '"'),
      if (length(a))
        unlist(lapply(
          seq_along(a),
          function(i) paste0(" ", names(a)[i], '="', a[[i]], '"')
        )),
      '><div class="combobox-selection combobox-component">',
      '<span aria-live="assertive" aria-atomic="true" role="log" class="combobox-component"></span>',
      '<input class="combobox-input combobox-component" role="combobox" type="text" ',
      'aria-expanded="false" aria-autocomplete="list" aria-controls="',
      id,
      '-listbox" aria-controls="',
      id,
      '-listbox" id="',
      id,
      '-input" autocomplete="off"></div>',
      if (clearable)
        '<button type="button" class="btn-close" title="clear selection"></button>',
      "</div>"
    ),
    paste0(
      '<div class="combobox-options combobox-component',
      if (multi) " multi",
      '" role="listbox"',
      ' id="',
      id,
      '-listbox" aria-labelledby="',
      id,
      '-label">'
    ),
    if (is.list(options)) {
      i <- 0
      if (is.null(names(options))) names(options) <- seq_along(options)
      if (missing(accordion)) accordion <- TRUE
      unlist(
        lapply(names(options), function(g) {
          group <- paste0(
            '<div class="combobox-group combobox-component',
            if (accordion) " accordion-item",
            '" data-group="',
            g,
            '">'
          )
          if (accordion) {
            gid <- paste0(id, "_", gsub("[\\s,/._-]+", "", g))
            group <- c(
              group,
              paste0(
                '<div id="',
                gid,
                '-label" class="accordion-header combobox-component">'
              ),
              paste0(
                '<button role="button" ',
                'data-bs-toggle="collapse" data-bs-target="#',
                gid,
                '" aria-expanded=false aria-controls="',
                gid,
                '" class="accordion-button combobox-component collapsed">',
                g,
                "</button></div>"
              ),
              paste0(
                '<div id="',
                gid,
                '" class="combobox-component accordion-collapse collapse" ',
                'data-group="',
                g,
                '" data-bs-parent="#',
                id,
                '-listbox"><div class="accordion-body combobox-component">'
              )
            )
          }
          for (gi in seq_along(options[[g]])) {
            i <<- i + 1
            group <- c(
              group,
              paste0(
                '<div class="combobox-option combobox-component',
                if (i == default) " selected",
                '" role="option" tabindex="0"',
                ' data-group="',
                g,
                '" id="',
                id,
                "-option",
                i,
                '" data-value="',
                options[[g]][[gi]],
                '" aria-selected="',
                if (i == default) "true" else "false",
                '">',
                display[[g]][[gi]],
                "</div>"
              )
            )
          }
          c(group, "</div>", if (accordion) "</div></div>")
        }),
        use.names = FALSE
      )
    } else if (
      length(options) > 1 ||
        !options %in% c("datasets", "variables", "ids", "palettes")
    ) {
      unlist(
        lapply(seq_along(options), function(i) {
          paste0(
            '<div class="combobox-component',
            if (i == default) " selected",
            '" role="option" tabindex="0"',
            ' id="',
            id,
            "-option",
            i,
            '" data-value="',
            options[i],
            '" aria-selected="',
            if (i == default) "true" else "false",
            '">',
            display[i],
            "</div>"
          )
        }),
        use.names = FALSE
      )
    },
    "</div>",
    if (floating_label)
      paste0(
        '<label id="',
        id,
        '-label" for="',
        id,
        '-input">',
        label,
        "</label>"
      ),
    if (!missing(reset_button)) {
      paste(
        c(
          '<button type="button" class="btn btn-link',
          if (!is.null(button_class)) paste("", button_class),
          ' select-reset">',
          if (is.character(reset_button)) reset_button else "Reset",
          "</button>"
        ),
        collapse = ""
      )
    },
    "</div>",
    "</div>"
  )
  if (missing(accordion) && !is.null(group_feature)) accordion <- TRUE
  if (as.row) r <- to_input_row(r)
  caller <- parent.frame()
  if (
    !is.null(attr(caller, "name")) &&
      attr(caller, "name") == "community_site_parts"
  ) {
    if (strict) caller$combobox[[id]]$strict <- strict
    if (numeric) caller$combobox[[id]]$numeric <- numeric
    if (search) caller$combobox[[id]]$search <- search
    if (multi) caller$combobox[[id]]$multi <- multi
    if (accordion)
      caller$combobox[[id]]$accordion <- accordion &&
        (is.list(options) || !is.null(group_feature))
    if (!is.null(group_feature)) caller$combobox[[id]]$group <- group_feature
    if (!is.null(filters)) caller$combobox[[id]]$filters <- as.list(filters)
    caller$content <- c(caller$content, r)
  }
  r
}
