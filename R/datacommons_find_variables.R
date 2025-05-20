#' Attempt to locate variables in a set of mapped variables.
#'
#' Somewhat fuzzily match entered variable names to mapped variable names, which
#' might be useful if variable names are specified in a view, but are changed slightly
#' in their source repositories.
#'
#' @param missed A vector of variable names or keywords to search for in the full set of mapped variables,
#' or the name of or path to a data commons view, from which to extract missed variables.
#' @param map Path to the \code{variable_map.csv} file created by \code{\link{datacommons_map_files}},
#' the path to a data commons project, or a variable map \code{data.frame}.
#' @param sep A regular expression to be treated as a term separator.
#' @param top Number of possible matches to return per \code{missed} entry.
#' @param metric Name of the similarity metric to use; see \code{\link[lingmatch]{lma_simets}}.
#' @examples
#' \dontrun{
#' # from a data commons project directory
#' datacommons_find_variables(c("variable_a", "variable_b"))
#'
#' # try to find matches to any missed variables in a view
#' datacommons_find_variables("view_name")
#' }
#' @return A list with an entry for each entered variable, containing \code{top} possible matches,
#' which are entries from the variable map, with an added .
#' @export

datacommons_find_variables <- function(
  missed,
  map = ".",
  sep = "[_:]",
  top = 3,
  metric = "cosine"
) {
  if (missing(missed)) cli_abort("{.arg missed} must be provided")
  nm <- length(missed)
  variable_map <- NULL
  if (is.character(map)) {
    if (file.exists(map)) {
      variable_map <- if (dir.exists(map)) {
        if (nm == 1 && file.exists(paste0(map, "/views/", missed))) {
          missed <- paste0(map, "/views/", missed)
        }
        datacommons_map_files(map, verbose = FALSE)$variables
      } else {
        read.csv(map)
      }
    } else {
      cli_abort("{.arg map} appears to be a path, but it does not exist")
    }
  } else {
    variable_map <- map
  }
  if (is.null(variable_map$full_name)) {
    cli_abort(
      "{.arg map} does not appear to be or point to a valid variable map"
    )
  }
  full_names <- unique(variable_map$full_name)
  if (nm == 1 && file.exists(missed)) {
    missed <- jsonlite::read_json(
      if (dir.exists(missed)) paste0(missed, "/view.json") else missed
    )
    missed <- as.character(missed$variables)
    if (!length(missed))
      cli_abort(
        "did not find any variables in the {.arg missed} view definition"
      )
    missed <- missed[!missed %in% full_names]
    if (!length(missed))
      cli_abort("all variables in the {.arg missed} view definition were found")
    nm <- length(missed)
  }
  mi <- seq_len(nm)
  snames <- gsub(sep, " ", c(missed, full_names))
  dtm <- lma_dtm(snames, numbers = TRUE, punct = TRUE, to.lower = FALSE)
  sim <- lma_simets(dtm[mi, ], dtm[-mi, ], metric, pairwise = FALSE)
  if (is.null(dim(sim))) sim <- matrix(sim, nm)
  top <- seq_len(min(top, length(full_names)))
  res <- lapply(mi, function(i) {
    v <- missed[[i]]
    if (v %in% full_names) {
      cbind(variable_map[variable_map$full_name == v, ], similarity = 1)
    } else {
      do.call(
        rbind,
        lapply(order(sim[i, ], decreasing = TRUE)[top], function(o) {
          vr <- variable_map[
            variable_map$full_name == full_names[[o]],
            ,
            drop = FALSE
          ]
          vr$similarity <- sim[i, o]
          vr
        })
      )
    }
  })
  names(res) <- missed
  res
}
