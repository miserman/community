#' Add a table to a webpage
#'
#' Adds a table to a webpage, based on specified or selected variables.
#'
#' @param variables The ID of a variable selecting input, or a list specifying columns (if \code{wide} is
#' \code{TRUE}) or included variables. Each entry should be a list with at least have a \code{name} entry with a
#' variable name. A \code{title} entry can be used to set a different display name for the variable. \code{name}
#' can also refer to feature names, which can be specified with a \code{source} entry set to \code{"features"}.
#' For example, \code{list(title = "Variable A", name = "a", source = "features")}. A vector can also be used
#' to specify variable names, with names setting titles (e.g., \code{c("Variable A" = "a")}). If not specified,
#' sources are attempted to be resolved automatically.
#' @param dataset The name of a dataset, or ID of a dataset selector, to find \code{variables} in;
#' used if \code{dataview} is not specified.
#' @param dataview The ID of an \code{\link{input_dataview}} component.
#' @param id Unique ID of the table.
#' @param click The ID of an input to set to a clicked row's entity ID.
#' @param subto A vector of output IDs to receive hover events from.
#' @param options A list of configuration options if \code{datatables} is \code{TRUE}, see
#' \href{https://datatables.net/reference/option}{DataTables Documentation}; otherwise,
#' only the \code{scrollY} option has an effect.
#' @param features A list of features columns to include if multiple variables are included and \code{wide} is
#' \code{TRUE}.
#' @param filters A list with names of \code{meta} entries (from \code{variable} entry in \code{\link{data_add}}'s
#' \code{meta} list), and values of target values for those entries, or the IDs of value selectors.
#' @param wide Logical; if \code{FALSE}, variables and years are spread across rows rather than columns.
#' If \code{variables} specifies a single variable, \code{wide = FALSE} will show the variable in a column, and
#' \code{wide = TRUE} will show the variable across time columns.
#' @param class Class names to add to the table.
#' @param datatables Logical; if \code{TRUE}, uses \href{https://datatables.net}{DataTables}.
#' @examples
#' output_table()
#' @return A character vector of the content to be added.
#' @export

output_table <- function(variables = NULL, dataset = NULL, dataview = NULL, id = NULL, click = NULL, subto = NULL,
                         options = NULL, features = NULL, filters = NULL, wide = TRUE, class = "compact", datatables = TRUE) {
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) && attr(caller, "name") == "community_site_parts"
  if (is.null(id)) id <- paste0("table", caller$uid)
  defaults <- list(
    paging = TRUE, scrollY = 500, scrollX = 500, scrollCollapse = TRUE,
    scroller = TRUE, deferRender = TRUE
  )
  if (!is.null(options$height)) {
    options$scrollY <- options$height
    options$height <- NULL
  }
  so <- names(options)
  if (!datatables && (!wide || (length(so) && any(so != "scrollY")))) {
    cli_warn(paste(
      "because {.arg datatables} is disabled, the {.arg wide} argument is ignored,",
      "and all {.arg options} except {.arg options$scrollY} are ignored"
    ))
  }
  for (n in names(defaults)) if (!n %in% so) options[[n]] <- defaults[[n]]
  type <- if (datatables) "datatable" else "table"
  r <- paste(c(
    paste0(
      if (!datatables) {
        paste0(
          '<div class="table-wrapper" style="max-height: ', options$scrollY, if (is.numeric(options$scrollY)) "px", '">'
        )
      },
      '<table class="auto-output tables', if (is.null(class)) "" else paste("", class), '"'
    ),
    if (!is.null(dataview)) paste0('data-view="', dataview, '"'),
    if (!is.null(click)) paste0('data-click="', click, '"'),
    paste0('id="', id, '" data-autoType="', type, '"></table>', if (!datatables) "</div>")
  ), collapse = " ")
  if (building) {
    if (!is.null(variables)) {
      if (!is.character(variables) || length(variables) > 1) {
        if (!is.list(variables)) {
          variables <- as.list(variables)
        } else if (!is.list(variables[[1]])) variables <- list(variables)
        vnames <- names(variables)
        for (i in seq_along(variables)) {
          if (is.null(names(variables[[i]]))) variables[[i]] <- list(name = variables[[i]][[1]])
          if (!is.null(vnames[i])) variables[[i]]$title <- vnames[i]
        }
      }
      options$variables <- variables
    }
    if (!is.null(features)) {
      if (!is.character(features) || length(features) > 1) {
        if (!is.list(features)) {
          features <- as.list(features)
        } else if (!is.list(features[[1]]) && "name" %in% names(features)) features <- list(features)
        vnames <- names(features)
        for (i in seq_along(features)) {
          if (is.null(names(features[[i]]))) features[[i]] <- list(name = features[[i]][[1]])
          if (!is.null(vnames[i])) features[[i]]$title <- vnames[i]
        }
      }
      options$features <- unname(features)
    }
    options$subto <- if (!is.null(subto) && length(subto) == 1) list(subto) else subto
    options$filters <- filters
    options$dataset <- dataset
    options$single_variable <- wide && length(variables) == 1
    options$wide <- if (!wide && length(variables) == 1) TRUE else wide
    if (datatables) {
      caller$dependencies$jquery <- list(
        type = "script",
        src = "https://cdn.jsdelivr.net/npm/jquery@3.7.0/dist/jquery.min.js",
        hash = "sha384-NXgwF8Kv9SSAr+jemKKcbvQsz+teULH/a5UNJvZc6kP47hZgl62M1vGnw6gHQhb1",
        loading = "defer"
      )
      caller$dependencies$datatables_style <- list(
        type = "stylesheet",
        src = "https://cdn.datatables.net/v/dt/dt-2.2.2/b-3.2.2/b-html5-3.2.2/sc-2.4.3/datatables.min.css",
        hash = "sha384-2Tg4N0NtIxIltJpvmVtiBiLc93avSPJVr4spCZtog5nnqobmiT2/mj7UFFfscMEs"
      )
      caller$dependencies$datatables <- list(
        type = "script",
        src = "https://cdn.datatables.net/v/dt/dt-2.2.2/b-3.2.2/b-html5-3.2.2/sc-2.4.3/datatables.min.js",
        hash = "sha384-mkTp+BRbBEYfimTZNE8ScMphDz479QMa9X6UCCslX269Ucx0uAK+MJv7k/EeNNY8",
        loading = "defer"
      )
      caller$credits$datatables <- list(
        name = "DataTables",
        url = "https://datatables.net",
        version = "2.2.2"
      )
    }
    if (datatables) caller$datatable[[id]] <- options else caller$table[[id]] <- options
    caller$content <- c(caller$content, r)
    caller$uid <- caller$uid + 1
  }
  r
}
